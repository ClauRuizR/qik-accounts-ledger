/**
 * Notified after a posting has been committed. Used to keep derived read
 * models (e.g. cached summaries) fresh. Must never be called inside the
 * database transaction, and failures must not affect the posting result.
 */
export abstract class LedgerEvents {
  abstract postingCommitted(accountId: string): Promise<void>;
}

/** Default implementation until a subscriber (cache) is registered. */
export class NoopLedgerEvents extends LedgerEvents {
  postingCommitted(): Promise<void> {
    return Promise.resolve();
  }
}
