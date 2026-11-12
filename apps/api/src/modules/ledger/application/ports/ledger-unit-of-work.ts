import type { Account } from '../../../accounts/domain/account.js';
import type { LedgerEntry, NewLedgerEntry } from '../../domain/ledger-entry.js';

/**
 * Operations available inside a single database transaction while posting.
 * Every call runs on the same connection/transaction.
 */
export interface PostingTransaction {
  /**
   * Loads the account and takes an exclusive row lock on it until the
   * transaction ends (SELECT … FOR UPDATE). Concurrent postings on the same
   * account are serialized here.
   */
  lockAccount(accountId: string): Promise<Account | null>;
  findEntryByIdempotencyKey(
    accountId: string,
    key: string,
  ): Promise<LedgerEntry | null>;
  insertEntry(entry: NewLedgerEntry): Promise<LedgerEntry>;
  /** Sets the new balance and bumps the account version. */
  updateBalance(accountId: string, balance: string): Promise<void>;
}

/**
 * Runs `work` atomically: commits if it resolves, rolls back everything if it
 * throws. The ledger entry and the balance update can never diverge.
 */
export abstract class LedgerUnitOfWork {
  abstract run<T>(work: (tx: PostingTransaction) => Promise<T>): Promise<T>;
}
