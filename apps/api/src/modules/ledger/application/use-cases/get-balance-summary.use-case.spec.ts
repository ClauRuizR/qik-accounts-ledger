import type { AppConfig } from '../../../../config/env.js';
import {
  InMemoryAccountRepository,
  InMemoryCacheStore,
} from '../../../../test-support/fakes.js';
import { GetOwnedAccountUseCase } from '../../../accounts/application/use-cases/get-owned-account.use-case.js';
import type { BalanceSummary } from '../../domain/balance-summary.js';
import { BalanceSummaryCache } from '../balance-summary-cache.js';
import {
  LedgerReadRepository,
  type TransactionPage,
} from '../ports/ledger-read.repository.js';
import { GetBalanceSummaryUseCase } from './get-balance-summary.use-case.js';

class FakeReadRepository extends LedgerReadRepository {
  summary: BalanceSummary | null = null;
  readonly computeSummary = vi.fn(() => Promise.resolve(this.summary));
  findTransactions(): Promise<TransactionPage> {
    return Promise.resolve({ items: [], hasNextPage: false, totalCount: 0 });
  }
}

const config = { SUMMARY_CACHE_TTL_SECONDS: 300 } as AppConfig;

describe('GetBalanceSummaryUseCase (cache-aside)', () => {
  let accounts: InMemoryAccountRepository;
  let store: InMemoryCacheStore;
  let repo: FakeReadRepository;
  let cache: BalanceSummaryCache;
  let useCase: GetBalanceSummaryUseCase;
  let accountId: string;

  const summaryAt = (version: number, balance: string): BalanceSummary => ({
    accountId,
    version,
    currency: 'DOP',
    currentBalance: balance,
    totalCredits: balance,
    totalDebits: '0.00',
    transactionCount: version,
    history: [{ at: new Date('2026-11-12T10:00:00Z'), balance }],
  });

  beforeEach(() => {
    accounts = new InMemoryAccountRepository();
    store = new InMemoryCacheStore();
    repo = new FakeReadRepository();
    cache = new BalanceSummaryCache(store, config);
    useCase = new GetBalanceSummaryUseCase(
      new GetOwnedAccountUseCase(accounts),
      repo,
      cache,
    );
    accountId = accounts.seed({
      userId: 'alice',
      balance: '50.00',
      version: 3,
    }).id;
  });

  it('computes on a miss and caches under the computed version with the TTL', async () => {
    repo.summary = summaryAt(3, '50.00');
    const result = await useCase.execute('alice', accountId);

    expect(result).toEqual(repo.summary);
    expect(store.set).toHaveBeenCalledWith(
      `ledger:summary:${accountId}:v3`,
      expect.any(String),
      300,
    );
  });

  it('serves a hit without querying the ledger (dates revived)', async () => {
    repo.summary = summaryAt(3, '50.00');
    await useCase.execute('alice', accountId);
    repo.computeSummary.mockClear();

    const result = await useCase.execute('alice', accountId);
    expect(repo.computeSummary).not.toHaveBeenCalled();
    expect(result.history[0].at).toBeInstanceOf(Date);
    expect(result).toEqual(repo.summary);
  });

  it('never serves a summary cached for an older version', async () => {
    store.store.set(
      `ledger:summary:${accountId}:v2`,
      JSON.stringify(summaryAt(2, '999.00')),
    );
    repo.summary = summaryAt(3, '50.00');
    await expect(useCase.execute('alice', accountId)).resolves.toMatchObject({
      currentBalance: '50.00',
    });
  });

  it('checks ownership even when a cached entry exists', async () => {
    repo.summary = summaryAt(3, '50.00');
    await useCase.execute('alice', accountId);
    await expect(useCase.execute('bob', accountId)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('treats a corrupt cache entry as a miss', async () => {
    store.store.set(`ledger:summary:${accountId}:v3`, '{not json');
    repo.summary = summaryAt(3, '50.00');
    await expect(useCase.execute('alice', accountId)).resolves.toMatchObject({
      currentBalance: '50.00',
    });
  });

  it('evicts the previous version after a posting commits', async () => {
    store.store.set(`ledger:summary:${accountId}:v3`, '{}');
    await cache.postingCommitted({ accountId, version: 4 });
    expect(store.store.has(`ledger:summary:${accountId}:v3`)).toBe(false);
  });
});
