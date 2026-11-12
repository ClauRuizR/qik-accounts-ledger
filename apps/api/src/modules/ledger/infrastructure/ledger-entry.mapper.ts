import type { LedgerEntry } from '../domain/ledger-entry.js';
import type { LedgerEntryOrmEntity } from './ledger-entry.orm-entity.js';

export const toDomainEntry = (row: LedgerEntryOrmEntity): LedgerEntry => ({
  id: row.id,
  seq: row.seq,
  accountId: row.accountId,
  type: row.type,
  amount: row.amount,
  balanceAfter: row.balanceAfter,
  description: row.description,
  idempotencyKey: row.idempotencyKey,
  createdAt: row.createdAt,
});
