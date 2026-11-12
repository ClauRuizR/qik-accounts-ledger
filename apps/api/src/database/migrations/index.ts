import { InitialSchema1762900000000 } from './1762900000000-InitialSchema.js';
import { LedgerEntryInsertTimestamp1762990000000 } from './1762990000000-LedgerEntryInsertTimestamp.js';

/** Ordered list of migrations. Register every new migration here. */
export const MIGRATIONS = [
  InitialSchema1762900000000,
  LedgerEntryInsertTimestamp1762990000000,
];
