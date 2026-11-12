import { Account } from '../domain/account.js';
import type { AccountOrmEntity } from './account.orm-entity.js';

export const toDomainAccount = (row: AccountOrmEntity): Account =>
  new Account({
    id: row.id,
    userId: row.userId,
    accountNumber: row.accountNumber,
    currency: row.currency,
    balance: row.balance,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
