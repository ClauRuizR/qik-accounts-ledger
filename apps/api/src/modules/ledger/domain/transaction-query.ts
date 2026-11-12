import { InvalidCursorError, InvalidDateRangeError } from './ledger.errors.js';
import type { LedgerEntry, TransactionType } from './ledger-entry.js';

export type SortOrder = 'ASC' | 'DESC';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Keyset position in the (created_at, seq) ordering. `createdAt` keeps the
 * database's microsecond precision as an ISO string — a JS Date would
 * truncate to milliseconds and break the keyset comparison.
 */
export interface CursorPosition {
  createdAt: string;
  seq: string;
}

export interface TransactionQuery {
  accountId: string;
  type?: TransactionType;
  /** Inclusive. */
  startDate?: Date;
  /** Inclusive. */
  endDate?: Date;
  limit: number;
  after?: CursorPosition;
  sortOrder: SortOrder;
}

export interface LedgerEntryWithPosition extends LedgerEntry {
  position: CursorPosition;
}

const ISO_MICROS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

/** Opaque cursor: base64url(JSON) of the keyset position. */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(
    JSON.stringify([position.createdAt, position.seq]),
  ).toString('base64url');
}

/** @throws InvalidCursorError for anything not produced by encodeCursor. */
export function decodeCursor(cursor: string): CursorPosition {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      ISO_MICROS.test(parsed[0]) &&
      typeof parsed[1] === 'string' &&
      /^\d{1,19}$/.test(parsed[1])
    ) {
      return { createdAt: parsed[0], seq: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw new InvalidCursorError();
}

export function assertValidDateRange(startDate?: Date, endDate?: Date): void {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new InvalidDateRangeError();
  }
}
