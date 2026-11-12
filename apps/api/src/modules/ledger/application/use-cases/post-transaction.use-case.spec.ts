import {
  InMemoryAccountRepository,
  InMemoryLedgerUnitOfWork,
} from '../../../../test-support/fakes.js';
import type { Account } from '../../../accounts/domain/account.js';
import { LedgerEvents } from '../ports/ledger-events.js';
import {
  type PostTransactionCommand,
  PostTransactionUseCase,
} from './post-transaction.use-case.js';

class SpyLedgerEvents extends LedgerEvents {
  readonly postingCommitted = vi.fn((_accountId: string) => Promise.resolve());
}

describe('PostTransactionUseCase', () => {
  let accounts: InMemoryAccountRepository;
  let uow: InMemoryLedgerUnitOfWork;
  let events: SpyLedgerEvents;
  let useCase: PostTransactionUseCase;
  let account: Account;

  const post = (overrides: Partial<PostTransactionCommand>) =>
    useCase.execute({
      userId: 'alice',
      accountId: account.id,
      type: 'CREDIT',
      amount: '10.00',
      ...overrides,
    });
  const balance = () => accounts.accounts.get(account.id)?.balance;

  beforeEach(() => {
    accounts = new InMemoryAccountRepository();
    uow = new InMemoryLedgerUnitOfWork(accounts);
    events = new SpyLedgerEvents();
    useCase = new PostTransactionUseCase(uow, events);
    account = accounts.seed({ userId: 'alice', balance: '100.00' });
  });

  describe('credit', () => {
    it('increases the balance and records the entry', async () => {
      const { entry, replayed } = await post({
        type: 'CREDIT',
        amount: '50.5',
        description: ' salary ',
      });

      expect(replayed).toBe(false);
      expect(entry).toMatchObject({
        accountId: account.id,
        type: 'CREDIT',
        amount: '50.50',
        balanceAfter: '150.50',
        description: 'salary',
        idempotencyKey: null,
      });
      expect(balance()).toBe('150.50');
      expect(accounts.accounts.get(account.id)?.version).toBe(1);
    });

    it('notifies listeners after commit', async () => {
      await post({ type: 'CREDIT' });
      expect(events.postingCommitted).toHaveBeenCalledWith(account.id);
    });

    it('still succeeds when a listener fails (posting is already committed)', async () => {
      events.postingCommitted.mockRejectedValueOnce(new Error('redis down'));
      await expect(post({ type: 'CREDIT' })).resolves.toMatchObject({
        replayed: false,
      });
      expect(balance()).toBe('110.00');
    });
  });

  describe('debit', () => {
    it('decreases the balance', async () => {
      const { entry } = await post({ type: 'DEBIT', amount: '30.25' });
      expect(entry.balanceAfter).toBe('69.75');
      expect(balance()).toBe('69.75');
    });

    it('allows debiting the exact balance', async () => {
      await post({ type: 'DEBIT', amount: '100.00' });
      expect(balance()).toBe('0.00');
    });

    it('rejects insufficient funds and leaves balance and ledger unchanged', async () => {
      await expect(
        post({ type: 'DEBIT', amount: '100.01' }),
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });
      expect(balance()).toBe('100.00');
      expect(uow.entries).toHaveLength(0);
      expect(events.postingCommitted).not.toHaveBeenCalled();
    });

    it('serializes concurrent debits: only one of two 80.00 debits on 100.00 succeeds', async () => {
      const results = await Promise.allSettled([
        post({ type: 'DEBIT', amount: '80.00' }),
        post({ type: 'DEBIT', amount: '80.00' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(balance()).toBe('20.00');
    });
  });

  describe('validation', () => {
    it.each(['0', '0.00', '-10.00', '1.001', 'abc', '1000000000.01'])(
      'rejects invalid amount %j before touching the ledger',
      async (amount) => {
        const run = vi.spyOn(uow, 'run');
        await expect(post({ amount })).rejects.toMatchObject({
          code: 'INVALID_AMOUNT',
        });
        expect(run).not.toHaveBeenCalled();
      },
    );

    it("rejects postings to another user's account as not found", async () => {
      const bobs = accounts.seed({ userId: 'bob', balance: '500.00' });
      await expect(
        post({ accountId: bobs.id, type: 'DEBIT' }),
      ).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
      expect(accounts.accounts.get(bobs.id)?.balance).toBe('500.00');
    });

    it('rejects postings to a missing account', async () => {
      await expect(
        post({ accountId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('rejects postings to an inactive account', async () => {
      const inactive = accounts.seed({ userId: 'alice', status: 'INACTIVE' });
      await expect(post({ accountId: inactive.id })).rejects.toMatchObject({
        code: 'ACCOUNT_INACTIVE',
      });
    });
  });

  describe('atomicity', () => {
    it('rolls back the ledger entry when the balance update fails', async () => {
      uow.failNextBalanceUpdate = true;
      await expect(post({ type: 'CREDIT', amount: '25.00' })).rejects.toThrow(
        'simulated database failure',
      );
      expect(uow.entries).toHaveLength(0);
      expect(balance()).toBe('100.00');
    });
  });

  describe('idempotency', () => {
    it('returns the original entry for a retried request without posting twice', async () => {
      const first = await post({
        type: 'CREDIT',
        amount: '10',
        idempotencyKey: 'k-1',
      });
      const retry = await post({
        type: 'CREDIT',
        amount: '10.00',
        idempotencyKey: 'k-1',
      });

      expect(retry.replayed).toBe(true);
      expect(retry.entry.id).toBe(first.entry.id);
      expect(uow.entries).toHaveLength(1);
      expect(balance()).toBe('110.00');
      expect(events.postingCommitted).toHaveBeenCalledTimes(1);
    });

    it('rejects reusing a key for a different request', async () => {
      await post({ type: 'CREDIT', amount: '10', idempotencyKey: 'k-1' });
      await expect(
        post({ type: 'CREDIT', amount: '20', idempotencyKey: 'k-1' }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      await expect(
        post({ type: 'DEBIT', amount: '10', idempotencyKey: 'k-1' }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(balance()).toBe('110.00');
    });

    it('scopes keys per account', async () => {
      const other = accounts.seed({ userId: 'alice', balance: '0.00' });
      await post({ idempotencyKey: 'shared' });
      await post({ accountId: other.id, idempotencyKey: 'shared' });
      expect(uow.entries).toHaveLength(2);
    });

    it('a failed request does not consume its key', async () => {
      await expect(
        post({ type: 'DEBIT', amount: '500.00', idempotencyKey: 'k-2' }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
      await post({ type: 'CREDIT', amount: '500.00', idempotencyKey: 'k-3' });
      await expect(
        post({ type: 'DEBIT', amount: '500.00', idempotencyKey: 'k-2' }),
      ).resolves.toMatchObject({ replayed: false });
      expect(balance()).toBe('100.00');
    });
  });
});
