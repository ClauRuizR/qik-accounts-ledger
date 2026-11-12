import { Inject, Injectable } from '@nestjs/common';
import { CacheStore } from '../../../common/cache/cache-store.js';
import { APP_CONFIG, type AppConfig } from '../../../config/env.js';
import type { BalanceSummary } from '../domain/balance-summary.js';
import { LedgerEvents, type PostingCommitted } from './ports/ledger-events.js';

/**
 * Cache-aside for balance summaries.
 *
 * Key: `ledger:summary:{accountId}:v{version}`. Every posting bumps the
 * account version in the same transaction as the balance, so a reader that
 * looked up the current version can never be served a summary computed at an
 * older version — staleness is impossible by construction, not by timing.
 * The previous version's key is deleted after commit to free memory; TTL
 * cleans up anything missed.
 */
@Injectable()
export class BalanceSummaryCache extends LedgerEvents {
  constructor(
    private readonly cache: CacheStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
  }

  static key(accountId: string, version: number): string {
    return `ledger:summary:${accountId}:v${version}`;
  }

  async get(
    accountId: string,
    version: number,
  ): Promise<BalanceSummary | null> {
    const raw = await this.cache.get(
      BalanceSummaryCache.key(accountId, version),
    );
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as BalanceSummary;
      return {
        ...parsed,
        history: parsed.history.map((p) => ({
          at: new Date(p.at),
          balance: p.balance,
        })),
      };
    } catch {
      return null; // corrupt entry: treat as a miss
    }
  }

  async set(summary: BalanceSummary): Promise<void> {
    await this.cache.set(
      BalanceSummaryCache.key(summary.accountId, summary.version),
      JSON.stringify(summary),
      this.config.SUMMARY_CACHE_TTL_SECONDS,
    );
  }

  /** LedgerEvents: invoked after a posting commits. */
  async postingCommitted({
    accountId,
    version,
  }: PostingCommitted): Promise<void> {
    await this.cache.delete(BalanceSummaryCache.key(accountId, version - 1));
  }
}
