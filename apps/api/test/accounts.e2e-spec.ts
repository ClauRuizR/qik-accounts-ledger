import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';
import { errorCode, gql, registerUser } from './support/graphql.js';

const CREATE = `mutation($input: CreateAccountInput) {
  createAccount(input: $input) {
    id accountNumber currency balance status createdAt updatedAt
  }
}`;
const MY_ACCOUNTS = `{ myAccounts { id accountNumber currency balance } }`;
const ACCOUNT = `query($id: ID!) { account(id: $id) { id currency balance status } }`;
const BALANCE = `query($id: ID!) {
  accountBalance(accountId: $id) { accountId balance currency asOf }
}`;

interface AccountData {
  id: string;
  accountNumber: string;
  currency: string;
  balance: string;
  status: string;
}

describe('Accounts (e2e)', () => {
  let t: TestApp;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  const create = async (token: string, input?: Record<string, unknown>) => {
    const res = await gql<{ createAccount: AccountData }>(
      t.http,
      CREATE,
      { input },
      token,
    );
    if (!res.data) throw new Error(JSON.stringify(res.errors));
    return res.data.createAccount;
  };

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource, t.cache);
    alice = await registerUser(t.http);
    bob = await registerUser(t.http);
  });
  afterAll(async () => {
    await t.close();
  });

  describe('createAccount', () => {
    it('creates an active DOP account with a zero balance by default', async () => {
      const account = await create(alice.token);
      expect(account).toMatchObject({
        currency: 'DOP',
        balance: '0.00',
        status: 'ACTIVE',
      });
      expect(account.accountNumber).toMatch(/^[1-9]\d{11}$/);

      const [row] = await t.dataSource.query(
        `SELECT user_id FROM accounts WHERE id = $1`,
        [account.id],
      );
      expect(row.user_id).toBe(alice.userId);
    });

    it('accepts a supported currency', async () => {
      await expect(
        create(alice.token, { currency: 'USD' }),
      ).resolves.toMatchObject({
        currency: 'USD',
      });
    });

    it('rejects an unsupported currency', async () => {
      const res = await gql(
        t.http,
        CREATE,
        { input: { currency: 'BTC' } },
        alice.token,
      );
      expect(errorCode(res)).toBe('BAD_USER_INPUT');
    });

    it('requires authentication', async () => {
      const res = await gql(t.http, CREATE, {});
      expect(errorCode(res)).toBe('UNAUTHENTICATED');
      const [{ count }] = await t.dataSource.query(
        `SELECT count(*)::int AS count FROM accounts`,
      );
      expect(count).toBe(0);
    });
  });

  describe('myAccounts', () => {
    it("returns only the caller's accounts, oldest first", async () => {
      const first = await create(alice.token);
      const second = await create(alice.token, { currency: 'EUR' });
      await create(bob.token);

      const res = await gql<{ myAccounts: AccountData[] }>(
        t.http,
        MY_ACCOUNTS,
        {},
        alice.token,
      );
      expect(res.data?.myAccounts.map((a) => a.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it('returns an empty list for a user without accounts', async () => {
      const res = await gql(t.http, MY_ACCOUNTS, {}, alice.token);
      expect(res.data).toEqual({ myAccounts: [] });
    });
  });

  describe('account / accountBalance', () => {
    it('returns details and balance of an owned account', async () => {
      const created = await create(alice.token);

      const details = await gql(
        t.http,
        ACCOUNT,
        { id: created.id },
        alice.token,
      );
      expect(details.data).toEqual({
        account: {
          id: created.id,
          currency: 'DOP',
          balance: '0.00',
          status: 'ACTIVE',
        },
      });

      const balance = await gql(
        t.http,
        BALANCE,
        { id: created.id },
        alice.token,
      );
      expect(balance.data).toEqual({
        accountBalance: {
          accountId: created.id,
          balance: '0.00',
          currency: 'DOP',
          asOf: expect.any(String),
        },
      });
    });

    it("hides other users' accounts behind ACCOUNT_NOT_FOUND", async () => {
      const bobsAccount = await create(bob.token);
      for (const query of [ACCOUNT, BALANCE]) {
        const res = await gql(
          t.http,
          query,
          { id: bobsAccount.id },
          alice.token,
        );
        expect(errorCode(res)).toBe('ACCOUNT_NOT_FOUND');
        expect(JSON.stringify(res)).not.toContain(bob.userId);
      }
    });

    it('returns ACCOUNT_NOT_FOUND for a non-existent id', async () => {
      const res = await gql(
        t.http,
        ACCOUNT,
        { id: '9b2d3c1e-7a4f-4e2b-8c6d-1f0a9e8b7c6d' },
        alice.token,
      );
      expect(errorCode(res)).toBe('ACCOUNT_NOT_FOUND');
    });

    it('rejects a malformed id without leaking database errors', async () => {
      const res = await gql(
        t.http,
        ACCOUNT,
        { id: "1' OR '1'='1" },
        alice.token,
      );
      expect(errorCode(res)).toBe('BAD_USER_INPUT');
      expect(JSON.stringify(res)).not.toMatch(/syntax|postgres|SELECT|22P02/i);
    });
  });
});
