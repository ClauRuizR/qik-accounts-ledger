import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';
import { errorCode, gql, registerUser } from './support/graphql.js';

const CREDIT = `mutation($input: PostTransactionInput!) {
  creditAccount(input: $input) { amount balanceAfter }
}`;

describe('Edge cases and hardening (e2e)', () => {
  let t: TestApp;
  let user: { token: string };
  let accountId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource, t.cache);
    user = await registerUser(t.http);
    const res = await gql<{ createAccount: { id: string } }>(
      t.http,
      `mutation { createAccount { id } }`,
      {},
      user.token,
    );
    accountId = res.data!.createAccount.id;
  });
  afterAll(async () => {
    await t.close();
  });

  describe('amount inputs', () => {
    it('normalizes leading zeros and missing decimals', async () => {
      const res = await gql<{ creditAccount: { amount: string } }>(
        t.http,
        CREDIT,
        { input: { accountId, amount: '000010.5' } },
        user.token,
      );
      expect(res.data?.creditAccount).toEqual({
        amount: '10.50',
        balanceAfter: '10.50',
      });
    });

    it('rejects absurdly long numbers as INVALID_AMOUNT, not a server error', async () => {
      const res = await gql(
        t.http,
        CREDIT,
        { input: { accountId, amount: '9'.repeat(500) } },
        user.token,
      );
      expect(errorCode(res)).toBe('INVALID_AMOUNT');
    });

    it.each(['1e3', '0x10', 'NaN', 'Infinity', ' ', '1.2.3'])(
      'rejects non-decimal notation %j at the scalar',
      async (amount) => {
        const res = await gql(
          t.http,
          CREDIT,
          { input: { accountId, amount } },
          user.token,
        );
        expect(errorCode(res)).toBe('BAD_USER_INPUT');
      },
    );
  });

  it('rejects a non-UUID accountId in mutation input', async () => {
    const res = await gql(
      t.http,
      CREDIT,
      { input: { accountId: 'not-a-uuid', amount: '1.00' } },
      user.token,
    );
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
    expect(res.errors?.[0].extensions.details).toEqual([
      'accountId must be a UUID',
    ]);
  });

  it('rejects unknown input fields (no mass assignment)', async () => {
    const res = await gql(
      t.http,
      CREDIT,
      { input: { accountId, amount: '1.00', balanceAfter: '999999.00' } },
      user.token,
    );
    expect(res.errors).toBeDefined();
    const [{ balance }] = await t.dataSource.query(
      `SELECT balance FROM accounts WHERE id = $1`,
      [accountId],
    );
    expect(balance).toBe('0.00');
  });

  it('never includes stack traces in error responses', async () => {
    const res = await gql(
      t.http,
      CREDIT,
      { input: { accountId, amount: '0' } },
      user.token,
    );
    expect(Object.keys(res.errors![0].extensions)).toEqual(['code']);
    expect(JSON.stringify(res)).not.toMatch(/stacktrace|at .*\.ts:\d+/i);
  });

  it('does not execute mutations sent over GET', async () => {
    const res = await request(t.http)
      .get('/graphql')
      .query({ query: `mutation { createAccount { id } }` })
      .set('Authorization', `Bearer ${user.token}`)
      .set('apollo-require-preflight', 'true');
    expect(res.status).toBeGreaterThanOrEqual(400);
    const [{ count }] = await t.dataSource.query(
      `SELECT count(*)::int AS count FROM accounts`,
    );
    expect(count).toBe(1);
  });

  it('blocks simple cross-site GET requests (CSRF prevention)', async () => {
    const res = await request(t.http)
      .get('/graphql')
      .query({ query: '{ health }' });
    expect(res.status).toBe(400);
  });

  it('does not accept batched operations', async () => {
    const res = await request(t.http)
      .post('/graphql')
      .set('Authorization', `Bearer ${user.token}`)
      .send([{ query: '{ health }' }, { query: '{ health }' }]);
    expect(res.status).toBe(400);
  });
});
