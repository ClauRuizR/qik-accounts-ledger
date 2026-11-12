export const TRANSACTION_TYPES = ['CREDIT', 'DEBIT'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** A posted, immutable ledger entry. Amounts are canonical decimal strings. */
export interface LedgerEntry {
  id: string;
  /** Monotonic database sequence; deterministic tiebreaker for ordering. */
  seq: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface NewLedgerEntry {
  accountId: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string;
  idempotencyKey: string | null;
}
