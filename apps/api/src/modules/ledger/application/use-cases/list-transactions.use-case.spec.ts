import { InMemoryAccountRepository } from '../../../../test-support/fakes.js';
import { GetOwnedAccountUseCase } from '../../../accounts/application/use-cases/get-owned-account.use-case.js';
import type { BalanceSummary } from '../../domain/balance-summary.js';
import {
  encodeCursor,
  type LedgerEntryWithPosition,
  type TransactionQuery,
} from '../../domain/transaction-query.js';
import {
  LedgerReadRepository,
  type TransactionPage,
} from '../ports/ledger-read.repository.js';
import { ListTransactionsUseCase } from './list-transactions.use-case.js';

class FakeReadRepository extends LedgerReadRepository {
  readonly findTransactions = vi.fn(
    (_query: TransactionQuery): Promise<TransactionPage> =>
      Promise.resolve({ items: this.items, hasNextPage: true, totalCount: 42 }),
  );
  items: LedgerEntryWithPosition[] = [];
  computeSummary(): Promise<BalanceSummary | null> {
    return Promise.resolve(null);
  }
}

const entry = (seq: string): LedgerEntryWithPosition => ({
  id: `id-${seq}`,
  seq,
  accountId: 'acc',
  type: 'CREDIT',
  amount: '1.00',
  balanceAfter: '1.00',
  description: '',
  idempotencyKey: null,
  createdAt: new Date('2026-11-12T10:00:00Z'),
  position: { createdAt: '2026-11-12T10:00:00.000001Z', seq },
});

describe('ListTransactionsUseCase', () => {
  let accounts: InMemoryAccountRepository;
  let repo: FakeReadRepository;
  let useCase: ListTransactionsUseCase;
  let accountId: string;

  beforeEach(() => {
    accounts = new InMemoryAccountRepository();
    repo = new FakeReadRepository();
    useCase = new ListTransactionsUseCase(
      new GetOwnedAccountUseCase(accounts),
      repo,
    );
    accountId = accounts.seed({ userId: 'alice' }).id;
  });

  it('applies defaults: 20 per page, newest first', async () => {
    await useCase.execute({ userId: 'alice', accountId });
    expect(repo.findTransactions).toHaveBeenCalledWith({
      accountId,
      type: undefined,
      startDate: undefined,
      endDate: undefined,
      limit: 20,
      after: undefined,
      sortOrder: 'DESC',
    });
  });

  it('passes filters and decodes the cursor', async () => {
    const position = { createdAt: '2026-11-12T10:00:00.000001Z', seq: '7' };
    const startDate = new Date('2026-11-01T00:00:00Z');
    const endDate = new Date('2026-11-30T23:59:59Z');
    await useCase.execute({
      userId: 'alice',
      accountId,
      type: 'DEBIT',
      startDate,
      endDate,
      first: 5,
      after: encodeCursor(position),
      sortOrder: 'ASC',
    });
    expect(repo.findTransactions).toHaveBeenCalledWith({
      accountId,
      type: 'DEBIT',
      startDate,
      endDate,
      limit: 5,
      after: position,
      sortOrder: 'ASC',
    });
  });

  it.each([
    [0, 1],
    [1000, 100],
  ])('clamps page size %i to %i', async (first, expected) => {
    await useCase.execute({ userId: 'alice', accountId, first });
    expect(repo.findTransactions.mock.calls[0][0].limit).toBe(expected);
  });

  it('builds pageInfo from the last item', async () => {
    repo.items = [entry('3'), entry('2')];
    const result = await useCase.execute({ userId: 'alice', accountId });
    expect(result.totalCount).toBe(42);
    expect(result.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: encodeCursor(entry('2').position),
    });
  });

  it('returns a null endCursor for an empty page', async () => {
    const result = await useCase.execute({ userId: 'alice', accountId });
    expect(result.pageInfo.endCursor).toBeNull();
  });

  it('rejects an inverted date range before querying', async () => {
    await expect(
      useCase.execute({
        userId: 'alice',
        accountId,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-11-01'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    expect(repo.findTransactions).not.toHaveBeenCalled();
  });

  it('rejects a tampered cursor', async () => {
    await expect(
      useCase.execute({ userId: 'alice', accountId, after: 'garbage' }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it("does not read another user's transactions", async () => {
    await expect(
      useCase.execute({ userId: 'bob', accountId }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
    expect(repo.findTransactions).not.toHaveBeenCalled();
  });
});
