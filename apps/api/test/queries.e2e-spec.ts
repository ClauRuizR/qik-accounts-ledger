import request from 'supertest';
import { BalanceSummaryCache } from '../src/modules/ledger/application/balance-summary-cache.js';
import { createTestApp, type TestApp } from './support/app.js';
import {
  resetDatabase,
  seedLedger,
  type SeedEntry,
} from './support/database.js';
import { errorCode, gql, registerUser } from './support/graphql.js';

const CREATE_ACCOUNT = `mutation { createAccount { id } }`;
const CREDIT = `mutation($input: PostTransactionInput!) { creditAccount(input: $input) { id } }`;
const TRANSACTIONS = `query($id: ID!, $filters: TransactionFilterInput) {
  accountTransactions(accountId: $id, filters: $filters) {
    items { id type amount balanceAfter createdAt }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}`;
const SUMMARY = `query($id: ID!, $limit: Int) {
  accountBalanceSummary(accountId: $id) {
    accountId currency currentBalance totalCredits totalDebits transactionCount
    history(limit: $limit) { at balance }
  }
}`;

interface Tx {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  createdAt: string;
}
interface Connection {
  items: Tx[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}
interface Summary {
  currentBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  history: { at: string; balance: string }[];
}

describe('Transaction history and balance summary (e2e)', () => {
  let t: TestApp;
  let user: { token: string; userId: string };
  let accountId: string;

  const createAccount = async (token = user.token) => {
    const res = await gql<{ createAccount: { id: string } }>(
      t.http,
      CREATE_ACCOUNT,
      {},
      token,
    );
    return res.data!.createAccount.id;
  };
  const transactions = (
    filters?: Record<string, unknown>,
    id = accountId,
    token = user.token,
  ) =>
    gql<{ accountTransactions: Connection }>(
      t.http,
      TRANSACTIONS,
      { id, filters },
      token,
    );
  const summary = (limit?: number, id = accountId, token = user.token) =>
    gql<{ accountBalanceSummary: Summary }>(
      t.http,
      SUMMARY,
      { id, limit },
      token,
    );

  /** 30 entries: one per day in November 2026 at 12:00 UTC; every 3rd is a debit. */
  const novemberLedger = (): SeedEntry[] =>
    Array.from({ length: 30 }, (_, i) => ({
      type: i % 3 === 2 ? 'DEBIT' : 'CREDIT',
      amount: i % 3 === 2 ? '5.00' : '10.00',
      at: `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
    }));

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource, t.cache);
    user = await registerUser(t.http);
    accountId = await createAccount();
  });
  afterAll(async () => {
    await t.close();
  });

  describe('accountTransactions', () => {
    beforeEach(async () => {
      await seedLedger(t.dataSource, accountId, novemberLedger());
    });

    it('returns the newest 20 first by default, with a total count', async () => {
      const res = await transactions();
      const page = res.data!.accountTransactions;

      expect(page.items).toHaveLength(20);
      expect(page.totalCount).toBe(30);
      expect(page.pageInfo.hasNextPage).toBe(true);
      expect(page.items[0].createdAt).toBe('2026-11-30T12:00:00.000Z');
      const times = page.items.map((i) => i.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('sorts oldest first with sortOrder ASC', async () => {
      const res = await transactions({ sortOrder: 'ASC', first: 3 });
      expect(
        res.data!.accountTransactions.items.map((i) => i.createdAt),
      ).toEqual([
        '2026-11-01T12:00:00.000Z',
        '2026-11-02T12:00:00.000Z',
        '2026-11-03T12:00:00.000Z',
      ]);
    });

    it.each(['DESC', 'ASC'])(
      'paginates through every entry exactly once (%s)',
      async (sortOrder) => {
        const seen: string[] = [];
        let after: string | null = null;
        let pages = 0;
        do {
          const res = await transactions({ first: 7, after, sortOrder });
          const page: Connection = res.data!.accountTransactions;
          seen.push(...page.items.map((i) => i.id));
          after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
          pages++;
        } while (after);

        expect(pages).toBe(5); // 7+7+7+7+2
        expect(seen).toHaveLength(30);
        expect(new Set(seen).size).toBe(30);
      },
    );

    it('filters by type', async () => {
      const res = await transactions({ type: 'DEBIT', first: 100 });
      const page = res.data!.accountTransactions;
      expect(page.totalCount).toBe(10);
      expect(page.items.every((i) => i.type === 'DEBIT')).toBe(true);
    });

    it('filters by an inclusive date range', async () => {
      const res = await transactions({
        startDate: '2026-11-10T12:00:00.000Z',
        endDate: '2026-11-12T12:00:00.000Z',
      });
      expect(
        res.data!.accountTransactions.items.map((i) => i.createdAt),
      ).toEqual([
        '2026-11-12T12:00:00.000Z',
        '2026-11-11T12:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
      ]);
    });

    it('supports open-ended ranges and combined filters with pagination', async () => {
      const res = await transactions({
        type: 'CREDIT',
        startDate: '2026-11-21T00:00:00.000Z',
        first: 2,
      });
      const page = res.data!.accountTransactions;
      expect(page.totalCount).toBe(6); // days 21–30 minus debit days 21, 24, 27, 30
      expect(page.items).toHaveLength(2);
      expect(page.pageInfo.hasNextPage).toBe(true);
    });

    it('orders entries sharing a timestamp deterministically by posting sequence', async () => {
      const other = await createAccount();
      const at = '2026-10-01T00:00:00.000Z';
      await seedLedger(t.dataSource, other, [
        { type: 'CREDIT', amount: '1.00', at },
        { type: 'CREDIT', amount: '2.00', at },
        { type: 'CREDIT', amount: '3.00', at },
      ]);
      const first = await transactions({ first: 2, sortOrder: 'ASC' }, other);
      const second = await transactions(
        {
          first: 2,
          sortOrder: 'ASC',
          after: first.data!.accountTransactions.pageInfo.endCursor,
        },
        other,
      );
      const amounts = [
        ...first.data!.accountTransactions.items,
        ...second.data!.accountTransactions.items,
      ].map((i) => i.amount);
      expect(amounts).toEqual(['1.00', '2.00', '3.00']);
    });

    it('returns an empty page for an account without transactions', async () => {
      const empty = await createAccount();
      const res = await transactions(undefined, empty);
      expect(res.data!.accountTransactions).toEqual({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0,
      });
    });

    describe('validation', () => {
      it('rejects an inverted date range', async () => {
        const res = await transactions({
          startDate: '2026-11-20T00:00:00Z',
          endDate: '2026-11-10T00:00:00Z',
        });
        expect(errorCode(res)).toBe('INVALID_DATE_RANGE');
      });

      it('rejects a tampered cursor', async () => {
        expect(
          errorCode(await transactions({ after: 'bm90LWEtY3Vyc29y' })),
        ).toBe('INVALID_CURSOR');
      });

      it.each([0, 101, -1])('rejects page size %i', async (first) => {
        expect(errorCode(await transactions({ first }))).toBe('BAD_USER_INPUT');
      });

      it('rejects a malformed date', async () => {
        expect(errorCode(await transactions({ startDate: 'yesterday' }))).toBe(
          'BAD_USER_INPUT',
        );
      });

      it('rejects an unknown transaction type', async () => {
        expect(errorCode(await transactions({ type: 'REFUND' }))).toBe(
          'BAD_USER_INPUT',
        );
      });
    });

    it("does not expose another user's transactions", async () => {
      const other = await registerUser(t.http);
      const res = await transactions(undefined, accountId, other.token);
      expect(errorCode(res)).toBe('ACCOUNT_NOT_FOUND');
      expect(res.data).toBeNull();
    });
  });

  describe('accountBalanceSummary', () => {
    it('reports zeros for a new account', async () => {
      const res = await summary();
      expect(res.data!.accountBalanceSummary).toEqual({
        accountId,
        currency: 'DOP',
        currentBalance: '0.00',
        totalCredits: '0.00',
        totalDebits: '0.00',
        transactionCount: 0,
        history: [],
      });
    });

    it('reports totals consistent with the ledger and recent history oldest first', async () => {
      await seedLedger(t.dataSource, accountId, novemberLedger());
      const res = await summary(3);
      const s = res.data!.accountBalanceSummary;

      // 20 credits × 10.00 and 10 debits × 5.00
      expect(s).toMatchObject({
        currentBalance: '150.00',
        totalCredits: '200.00',
        totalDebits: '50.00',
        transactionCount: 30,
      });
      expect(s.history).toEqual([
        { at: '2026-11-28T12:00:00.000Z', balance: '145.00' },
        { at: '2026-11-29T12:00:00.000Z', balance: '155.00' },
        { at: '2026-11-30T12:00:00.000Z', balance: '150.00' },
      ]);
    });

    it('defaults to 30 history points and validates the limit', async () => {
      await seedLedger(t.dataSource, accountId, novemberLedger());
      const res = await summary();
      expect(res.data!.accountBalanceSummary.history).toHaveLength(30);
      expect(errorCode(await summary(0))).toBe('BAD_USER_INPUT');
      expect(errorCode(await summary(101))).toBe('BAD_USER_INPUT');
    });

    it("does not expose another user's summary, even when cached", async () => {
      await summary(); // populate cache for the owner
      const other = await registerUser(t.http);
      expect(errorCode(await summary(undefined, accountId, other.token))).toBe(
        'ACCOUNT_NOT_FOUND',
      );
    });
  });

  describe('Redis caching', () => {
    const versionOf = async (id: string): Promise<number> => {
      const [row] = await t.dataSource.query(
        `SELECT version FROM accounts WHERE id = $1`,
        [id],
      );
      return row.version as number;
    };

    it('caches the summary under the current account version', async () => {
      await gql(
        t.http,
        CREDIT,
        { input: { accountId, amount: '10.00' } },
        user.token,
      );
      await summary();
      const key = BalanceSummaryCache.key(
        accountId,
        await versionOf(accountId),
      );
      expect(await t.cache.get(key)).toContain('"currentBalance":"10.00"');
    });

    it('serves from cache, and a posting makes the next read fresh', async () => {
      await summary();
      // Poison the current-version entry to prove reads really come from Redis.
      const key = BalanceSummaryCache.key(
        accountId,
        await versionOf(accountId),
      );
      const poisoned = JSON.parse((await t.cache.get(key))!) as Record<
        string,
        unknown
      >;
      await t.cache.set(
        key,
        JSON.stringify({ ...poisoned, totalCredits: '123.45' }),
        60,
      );
      expect((await summary()).data!.accountBalanceSummary.totalCredits).toBe(
        '123.45',
      );

      await gql(
        t.http,
        CREDIT,
        { input: { accountId, amount: '7.50' } },
        user.token,
      );

      const fresh = (await summary()).data!.accountBalanceSummary;
      expect(fresh).toMatchObject({
        currentBalance: '7.50',
        totalCredits: '7.50',
      });
      expect(await t.cache.get(key)).toBeNull(); // previous version evicted
    });

    it('balance queries are never served from cache', async () => {
      await summary();
      await gql(
        t.http,
        CREDIT,
        { input: { accountId, amount: '5.00' } },
        user.token,
      );
      const res = await gql<{ accountBalance: { balance: string } }>(
        t.http,
        `query($id: ID!) { accountBalance(accountId: $id) { balance } }`,
        { id: accountId },
        user.token,
      );
      expect(res.data!.accountBalance.balance).toBe('5.00');
    });
  });
});

describe('Redis unavailable (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    // Nothing listens on this port: every cache call fails.
    t = await createTestApp({ redisUrl: 'redis://127.0.0.1:6390' });
  });
  afterAll(async () => {
    await t.close();
  });

  it('keeps posting and serving summaries from PostgreSQL', async () => {
    await resetDatabase(t.dataSource);
    const user = await registerUser(t.http);
    const res = await gql<{ createAccount: { id: string } }>(
      t.http,
      CREATE_ACCOUNT,
      {},
      user.token,
    );
    const accountId = res.data!.createAccount.id;

    const credit = await gql(
      t.http,
      CREDIT,
      { input: { accountId, amount: '42.00' } },
      user.token,
    );
    expect(credit.errors).toBeUndefined();

    const s = await gql<{ accountBalanceSummary: Summary }>(
      t.http,
      SUMMARY,
      { id: accountId },
      user.token,
    );
    expect(s.data!.accountBalanceSummary).toMatchObject({
      currentBalance: '42.00',
      totalCredits: '42.00',
    });
  });

  it('reports a degraded but available service', async () => {
    const res = await request(t.http).get('/health').expect(200);
    expect(res.body).toEqual({
      status: 'degraded',
      database: 'up',
      redis: 'down',
    });
  });
});
