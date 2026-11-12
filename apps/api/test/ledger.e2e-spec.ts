import { randomUUID } from 'node:crypto';
import { LedgerUnitOfWork } from '../src/modules/ledger/application/ports/ledger-unit-of-work.js';
import { PostTransactionUseCase } from '../src/modules/ledger/application/use-cases/post-transaction.use-case.js';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';
import {
  errorCode,
  gql,
  type GqlResponse,
  registerUser,
} from './support/graphql.js';

const CREATE_ACCOUNT = `mutation { createAccount { id } }`;
const CREDIT = `mutation($input: PostTransactionInput!) {
  creditAccount(input: $input) { id accountId type amount balanceAfter description createdAt }
}`;
const DEBIT = `mutation($input: PostTransactionInput!) {
  debitAccount(input: $input) { id accountId type amount balanceAfter description createdAt }
}`;

interface Tx {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string;
}
type CreditRes = GqlResponse<{ creditAccount: Tx }>;
type DebitRes = GqlResponse<{ debitAccount: Tx }>;

describe('Ledger (e2e, PostgreSQL)', () => {
  let t: TestApp;
  let user: { token: string; userId: string };

  const createAccount = async (token = user.token): Promise<string> => {
    const res = await gql<{ createAccount: { id: string } }>(
      t.http,
      CREATE_ACCOUNT,
      {},
      token,
    );
    return res.data!.createAccount.id;
  };
  const credit = (
    input: Record<string, unknown>,
    token = user.token,
  ): Promise<CreditRes> => gql(t.http, CREDIT, { input }, token);
  const debit = (
    input: Record<string, unknown>,
    token = user.token,
  ): Promise<DebitRes> => gql(t.http, DEBIT, { input }, token);

  const dbBalance = async (accountId: string): Promise<string> => {
    const [row] = await t.dataSource.query(
      `SELECT balance FROM accounts WHERE id = $1`,
      [accountId],
    );
    return row.balance as string;
  };
  const entryCount = async (accountId: string): Promise<number> => {
    const [row] = await t.dataSource.query(
      `SELECT count(*)::int AS n FROM ledger_entries WHERE account_id = $1`,
      [accountId],
    );
    return row.n as number;
  };
  const fundedAccount = async (amount: string): Promise<string> => {
    const accountId = await createAccount();
    const res = await credit({
      accountId,
      amount,
      description: 'initial funding',
    });
    expect(res.errors).toBeUndefined();
    return accountId;
  };

  /**
   * Ledger invariants that must hold after any sequence of operations:
   *  1. balance = Σ credits − Σ debits
   *  2. balance = balance_after of the latest entry
   *  3. replaying entries in sequence order reproduces every balance_after
   */
  const expectLedgerConsistent = async (accountId: string): Promise<void> => {
    const [{ balance, net }] = await t.dataSource.query(
      `SELECT a.balance,
              COALESCE(SUM(CASE WHEN e.type = 'CREDIT' THEN e.amount ELSE -e.amount END), 0)::numeric(20,2) AS net
         FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
        WHERE a.id = $1 GROUP BY a.balance`,
      [accountId],
    );
    expect(net).toBe(balance);

    const entries: { type: string; amount: string; balance_after: string }[] =
      await t.dataSource.query(
        `SELECT type, amount, balance_after FROM ledger_entries
          WHERE account_id = $1 ORDER BY seq`,
        [accountId],
      );
    let running = 0n; // integer cents — exact, no floats
    const cents = (v: string) => BigInt(v.replace('.', ''));
    for (const e of entries) {
      running += e.type === 'CREDIT' ? cents(e.amount) : -cents(e.amount);
      expect(running).toBeGreaterThanOrEqual(0n);
      expect(cents(e.balance_after)).toBe(running);
    }
    if (entries.length > 0) expect(entries.at(-1)!.balance_after).toBe(balance);
  };

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource);
    user = await registerUser(t.http);
  });
  afterAll(async () => {
    await t.close();
  });

  describe('credit and debit', () => {
    it('credits increase and debits decrease the balance', async () => {
      const accountId = await createAccount();

      const c = await credit({
        accountId,
        amount: '150.75',
        description: 'salary',
      });
      expect(c.data?.creditAccount).toMatchObject({
        type: 'CREDIT',
        amount: '150.75',
        balanceAfter: '150.75',
        description: 'salary',
      });

      const d = await debit({ accountId, amount: '50.25' });
      expect(d.data?.debitAccount).toMatchObject({
        type: 'DEBIT',
        amount: '50.25',
        balanceAfter: '100.50',
      });

      expect(await dbBalance(accountId)).toBe('100.50');
      const [{ version }] = await t.dataSource.query(
        `SELECT version FROM accounts WHERE id = $1`,
        [accountId],
      );
      expect(version).toBe(2);
      await expectLedgerConsistent(accountId);
    });

    it('is exact with amounts that break floating point', async () => {
      const accountId = await createAccount();
      await credit({ accountId, amount: '0.10' });
      await credit({ accountId, amount: '0.20' });
      expect(await dbBalance(accountId)).toBe('0.30');
      await debit({ accountId, amount: '0.30' });
      expect(await dbBalance(accountId)).toBe('0.00');
    });

    it('rejects insufficient funds and leaves balance and ledger unchanged', async () => {
      const accountId = await fundedAccount('100.00');
      const res = await debit({ accountId, amount: '100.01' });

      expect(errorCode(res)).toBe('INSUFFICIENT_FUNDS');
      expect(await dbBalance(accountId)).toBe('100.00');
      expect(await entryCount(accountId)).toBe(1);
    });

    it.each(['0', '0.00', '-5.00', '10.001', '1000000000.01'])(
      'rejects invalid amount %j with INVALID_AMOUNT',
      async (amount) => {
        const accountId = await createAccount();
        const res = await credit({ accountId, amount });
        expect(errorCode(res)).toBe('INVALID_AMOUNT');
        expect(await entryCount(accountId)).toBe(0);
      },
    );

    it('rejects JSON numbers for amounts (no float transport)', async () => {
      const accountId = await createAccount();
      const res = await credit({ accountId, amount: 10.5 });
      expect(errorCode(res)).toBe('BAD_USER_INPUT');
    });

    it("cannot post to another user's account", async () => {
      const other = await registerUser(t.http);
      const othersAccount = await createAccount(other.token);
      await credit({ accountId: othersAccount, amount: '500.00' }, other.token);

      const res = await debit({ accountId: othersAccount, amount: '500.00' });
      expect(errorCode(res)).toBe('ACCOUNT_NOT_FOUND');
      expect(await dbBalance(othersAccount)).toBe('500.00');
    });

    it('rejects postings to an inactive account', async () => {
      const accountId = await createAccount();
      await t.dataSource.query(
        `UPDATE accounts SET status = 'INACTIVE' WHERE id = $1`,
        [accountId],
      );
      expect(errorCode(await credit({ accountId, amount: '1.00' }))).toBe(
        'ACCOUNT_INACTIVE',
      );
    });

    it('validates description length and idempotency key format', async () => {
      const accountId = await createAccount();
      expect(
        errorCode(
          await credit({
            accountId,
            amount: '1.00',
            description: 'x'.repeat(256),
          }),
        ),
      ).toBe('BAD_USER_INPUT');
      expect(
        errorCode(
          await credit({
            accountId,
            amount: '1.00',
            idempotencyKey: 'bad key!',
          }),
        ),
      ).toBe('BAD_USER_INPUT');
    });

    it('requires authentication', async () => {
      const accountId = await createAccount();
      const res = await gql(t.http, CREDIT, {
        input: { accountId, amount: '1.00' },
      });
      expect(errorCode(res)).toBe('UNAUTHENTICATED');
    });
  });

  describe('atomicity and rollback', () => {
    it('rolls back the ledger entry when the balance update violates a constraint', async () => {
      const accountId = await fundedAccount('10.00');
      const uow = t.app.get(LedgerUnitOfWork);

      await expect(
        uow.run(async (tx) => {
          await tx.lockAccount(accountId);
          await tx.insertEntry({
            accountId,
            type: 'DEBIT',
            amount: '50.00',
            balanceAfter: '0.00',
            description: 'should vanish',
            idempotencyKey: null,
          });
          // Bypasses the domain rule to prove the DB constraint + rollback work.
          await tx.updateBalance(accountId, '-40.00');
        }),
      ).rejects.toThrow(/accounts_balance_non_negative_ck/);

      expect(await dbBalance(accountId)).toBe('10.00');
      expect(await entryCount(accountId)).toBe(1);
    });

    it('rolls back everything when the work fails after writing', async () => {
      const accountId = await fundedAccount('10.00');
      const uow = t.app.get(LedgerUnitOfWork);

      await expect(
        uow.run(async (tx) => {
          await tx.insertEntry({
            accountId,
            type: 'CREDIT',
            amount: '5.00',
            balanceAfter: '15.00',
            description: 'should vanish',
            idempotencyKey: null,
          });
          await tx.updateBalance(accountId, '15.00');
          throw new Error('crash before commit');
        }),
      ).rejects.toThrow('crash before commit');

      expect(await dbBalance(accountId)).toBe('10.00');
      expect(await entryCount(accountId)).toBe(1);
      await expectLedgerConsistent(accountId);
    });
  });

  describe('concurrency', () => {
    it('balance 100: of two concurrent 80.00 debits exactly one succeeds, leaving 20.00', async () => {
      // Repeated on fresh accounts to make an interleaving bug very unlikely to hide.
      for (let round = 0; round < 10; round++) {
        const accountId = await fundedAccount('100.00');

        const results = await Promise.all([
          debit({ accountId, amount: '80.00' }),
          debit({ accountId, amount: '80.00' }),
        ]);

        const succeeded = results.filter((r) => r.data?.debitAccount);
        const rejected = results.filter(
          (r) => errorCode(r) === 'INSUFFICIENT_FUNDS',
        );
        expect(succeeded).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(succeeded[0].data?.debitAccount.balanceAfter).toBe('20.00');
        expect(await dbBalance(accountId)).toBe('20.00');
        expect(await entryCount(accountId)).toBe(2);
        await expectLedgerConsistent(accountId);
      }
    });

    it('a posting waits for the row lock held by another transaction', async () => {
      const accountId = await fundedAccount('100.00');
      const uow = t.app.get(LedgerUnitOfWork);
      const useCase = t.app.get(PostTransactionUseCase);

      let releaseLock!: () => void;
      let lockAcquired!: () => void;
      const acquired = new Promise<void>((r) => (lockAcquired = r));
      const holder = uow.run(async (tx) => {
        await tx.lockAccount(accountId);
        lockAcquired();
        await new Promise<void>((r) => (releaseLock = r));
        await tx.insertEntry({
          accountId,
          type: 'DEBIT',
          amount: '80.00',
          balanceAfter: '20.00',
          description: 'holder',
          idempotencyKey: null,
        });
        await tx.updateBalance(accountId, '20.00');
      });
      await acquired;

      let settled = false;
      const contender = useCase
        .execute({
          userId: user.userId,
          accountId,
          type: 'DEBIT',
          amount: '80.00',
        })
        .finally(() => (settled = true));

      await new Promise((r) => setTimeout(r, 300));
      expect(settled).toBe(false); // blocked on FOR UPDATE, not reading a stale balance

      releaseLock();
      await holder;
      await expect(contender).rejects.toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });
      expect(await dbBalance(accountId)).toBe('20.00');
    });

    it('20 concurrent debits of 10.00 on 100.00: exactly 10 succeed, balance 0.00', async () => {
      const accountId = await fundedAccount('100.00');
      const results = await Promise.all(
        Array.from({ length: 20 }, () => debit({ accountId, amount: '10.00' })),
      );

      expect(results.filter((r) => r.data?.debitAccount)).toHaveLength(10);
      expect(
        results.filter((r) => errorCode(r) === 'INSUFFICIENT_FUNDS'),
      ).toHaveLength(10);
      expect(await dbBalance(accountId)).toBe('0.00');
      await expectLedgerConsistent(accountId);
    });

    it('keeps the ledger consistent under a concurrent mix of credits and debits', async () => {
      const accountId = await fundedAccount('50.00');
      const ops = Array.from({ length: 40 }, (_, i) =>
        i % 3 === 0
          ? credit({ accountId, amount: `${(i % 7) + 1}.25` })
          : debit({ accountId, amount: `${(i % 5) + 1}.10` }),
      );
      const results = await Promise.all(ops);

      // Every request either posted or was cleanly rejected for funds.
      for (const r of results) {
        if (r.errors) expect(errorCode(r)).toBe('INSUFFICIENT_FUNDS');
      }
      await expectLedgerConsistent(accountId);
    });
  });

  describe('idempotency', () => {
    it('a retried request returns the original transaction and posts once', async () => {
      const accountId = await createAccount();
      const input = {
        accountId,
        amount: '25.00',
        description: 'deposit',
        idempotencyKey: 'abc-1',
      };

      const first = await credit(input);
      const retry = await credit({ ...input, amount: '25' });

      expect(retry.data?.creditAccount.id).toBe(first.data?.creditAccount.id);
      expect(await dbBalance(accountId)).toBe('25.00');
      expect(await entryCount(accountId)).toBe(1);
    });

    it('concurrent retries with the same key post exactly once', async () => {
      const accountId = await createAccount();
      const input = {
        accountId,
        amount: '10.00',
        idempotencyKey: randomUUID(),
      };

      const results = await Promise.all(
        Array.from({ length: 10 }, () => credit(input)),
      );

      const ids = new Set(results.map((r) => r.data?.creditAccount.id));
      expect(results.every((r) => r.errors === undefined)).toBe(true);
      expect(ids.size).toBe(1);
      expect(await dbBalance(accountId)).toBe('10.00');
      expect(await entryCount(accountId)).toBe(1);
    });

    it('reusing a key for a different request is a conflict', async () => {
      const accountId = await fundedAccount('100.00');
      await debit({ accountId, amount: '10.00', idempotencyKey: 'k' });
      const res = await debit({
        accountId,
        amount: '20.00',
        idempotencyKey: 'k',
      });

      expect(errorCode(res)).toBe('IDEMPOTENCY_CONFLICT');
      expect(await dbBalance(accountId)).toBe('90.00');
    });
  });

  it('posted ledger entries cannot be modified through the database', async () => {
    const accountId = await fundedAccount('100.00');
    await expect(
      t.dataSource.query(
        `UPDATE ledger_entries SET amount = 1 WHERE account_id = $1`,
        [accountId],
      ),
    ).rejects.toThrow(/append-only/);
  });
});
