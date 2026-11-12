import { Injectable } from '@nestjs/common';
import { GetOwnedAccountUseCase } from '../../../accounts/application/use-cases/get-owned-account.use-case.js';
import { AccountNotFoundError } from '../../../accounts/domain/account.errors.js';
import {
  type BalanceSummary,
  MAX_HISTORY_POINTS,
} from '../../domain/balance-summary.js';
import { BalanceSummaryCache } from '../balance-summary-cache.js';
import { LedgerReadRepository } from '../ports/ledger-read.repository.js';

@Injectable()
export class GetBalanceSummaryUseCase {
  constructor(
    private readonly getOwnedAccount: GetOwnedAccountUseCase,
    private readonly ledger: LedgerReadRepository,
    private readonly cache: BalanceSummaryCache,
  ) {}

  async execute(userId: string, accountId: string): Promise<BalanceSummary> {
    // Ownership is always checked against PostgreSQL — never served from cache.
    // This read also yields the current version used in the cache key.
    const account = await this.getOwnedAccount.execute(userId, accountId);

    const cached = await this.cache.get(account.id, account.version);
    if (cached) return cached;

    const summary = await this.ledger.computeSummary(
      account.id,
      MAX_HISTORY_POINTS,
    );
    if (!summary) throw new AccountNotFoundError();
    // Stored under the version it was computed at (which may be newer than
    // `account.version` if a posting committed in between) — never mislabeled.
    await this.cache.set(summary);
    return summary;
  }
}
