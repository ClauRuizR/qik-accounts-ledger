import type { BalanceSummary } from '../../domain/balance-summary.js';
import type {
  LedgerEntryWithPosition,
  TransactionQuery,
} from '../../domain/transaction-query.js';

export interface TransactionPage {
  items: LedgerEntryWithPosition[];
  hasNextPage: boolean;
  /** Matches the filters, ignoring the cursor. */
  totalCount: number;
}

/** Read-side persistence port for the ledger. */
export abstract class LedgerReadRepository {
  abstract findTransactions(query: TransactionQuery): Promise<TransactionPage>;
  /**
   * Computes balance, totals and recent history from a single snapshot.
   * Returns null if the account does not exist.
   */
  abstract computeSummary(
    accountId: string,
    historyPoints: number,
  ): Promise<BalanceSummary | null>;
}
