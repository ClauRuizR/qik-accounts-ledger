import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';

describe('Foundation (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource, t.cache);
  });
  afterAll(async () => {
    await t.close();
  });

  it('GET /health reports the database as up', async () => {
    const res = await request(t.http).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up', redis: 'up' });
  });

  it('serves the GraphQL endpoint', async () => {
    const res = await request(t.http)
      .post('/graphql')
      .send({ query: '{ health }' })
      .expect(200);
    expect(res.body).toEqual({ data: { health: 'ok' } });
  });

  it('returns a sanitized error code for invalid queries', async () => {
    const res = await request(t.http)
      .post('/graphql')
      .send({ query: '{ doesNotExist }' });
    expect(res.body.errors[0].extensions).toEqual({
      code: 'GRAPHQL_VALIDATION_FAILED',
    });
  });

  describe('schema constraints', () => {
    async function seedAccount(balance = '0.00'): Promise<string> {
      const [user] = await t.dataSource.query(
        `INSERT INTO users (email, password_hash) VALUES ('a@b.co', 'x') RETURNING id`,
      );
      const [account] = await t.dataSource.query(
        `INSERT INTO accounts (user_id, account_number, currency, balance)
         VALUES ($1, '100000000001', 'DOP', $2) RETURNING id`,
        [user.id, balance],
      );
      return account.id as string;
    }

    it('rejects a negative account balance', async () => {
      await expect(seedAccount('-0.01')).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });

    it('rejects non-positive ledger amounts', async () => {
      const accountId = await seedAccount();
      await expect(
        t.dataSource.query(
          `INSERT INTO ledger_entries (account_id, type, amount, balance_after)
           VALUES ($1, 'CREDIT', 0, 0)`,
          [accountId],
        ),
      ).rejects.toThrow(/ledger_entries_amount_positive_ck/);
    });

    it('rejects a duplicate idempotency key on the same account', async () => {
      const accountId = await seedAccount();
      const insert = () =>
        t.dataSource.query(
          `INSERT INTO ledger_entries (account_id, type, amount, balance_after, idempotency_key)
           VALUES ($1, 'CREDIT', 10, 10, 'key-1')`,
          [accountId],
        );
      await insert();
      await expect(insert()).rejects.toThrow(/ledger_entries_idempotency_uq/);
    });

    it('makes posted ledger entries immutable', async () => {
      const accountId = await seedAccount();
      await t.dataSource.query(
        `INSERT INTO ledger_entries (account_id, type, amount, balance_after)
         VALUES ($1, 'CREDIT', 10, 10)`,
        [accountId],
      );
      await expect(
        t.dataSource.query(`UPDATE ledger_entries SET amount = 99`),
      ).rejects.toThrow(/append-only/);
      await expect(
        t.dataSource.query(`DELETE FROM ledger_entries`),
      ).rejects.toThrow(/append-only/);
    });
  });
});
