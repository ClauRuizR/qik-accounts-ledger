import type { Currency } from '../../accounts/domain/currency.js';

export interface BalancePoint {
  at: Date;
  balance: string;
}

/**
 * Derived read model. Computed from one consistent database snapshot, so
 * currentBalance === totalCredits − totalDebits always holds.
 */
export interface BalanceSummary {
  accountId: string;
  /** Account version the summary was computed at (cache key component). */
  version: number;
  currency: Currency;
  currentBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  /** Most recent balance points, oldest first. At most MAX_HISTORY_POINTS. */
  history: BalancePoint[];
}

export const MAX_HISTORY_POINTS = 100;
