/**
 * Columns aliased to the LedgerEntry shape. NUMERIC and bigint values stay
 * strings (pg default), so no precision is lost on the way to the client.
 */
export const ENTRY_COLUMNS = `id, seq::text AS seq, account_id AS "accountId", type, amount,
  balance_after AS "balanceAfter", description, idempotency_key AS "idempotencyKey",
  created_at AS "createdAt"`;

/** created_at with full microsecond precision, for keyset cursors. */
export const CURSOR_TS_COLUMN = `to_char(created_at AT TIME ZONE 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTs"`;
