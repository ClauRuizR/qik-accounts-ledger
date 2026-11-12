export interface PostingCommitted {
  accountId: string;
  /** Account version after the posting. */
  version: number;
}

/**
 * Notified after a posting has been committed. Used to keep derived read
 * models (e.g. cached summaries) tidy. Never called inside the database
 * transaction; failures must not affect the posting result.
 */
export abstract class LedgerEvents {
  abstract postingCommitted(event: PostingCommitted): Promise<void>;
}
