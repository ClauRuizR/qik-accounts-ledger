import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { Account } from '../../accounts/domain/account.js';
import { toDomainAccount } from '../../accounts/infrastructure/account.mapper.js';
import { AccountOrmEntity } from '../../accounts/infrastructure/account.orm-entity.js';
import { isUniqueViolation } from '../../../common/errors/postgres-errors.js';
import {
  LedgerUnitOfWork,
  type PostingTransaction,
} from '../application/ports/ledger-unit-of-work.js';
import { IdempotencyConflictError } from '../domain/ledger.errors.js';
import type { LedgerEntry, NewLedgerEntry } from '../domain/ledger-entry.js';
import { toDomainEntry } from './ledger-entry.mapper.js';
import { ENTRY_COLUMNS } from './ledger-entry.sql.js';
import { LedgerEntryOrmEntity } from './ledger-entry.orm-entity.js';

/** Upper bound on how long a posting waits for another posting's row lock. */
const LOCK_TIMEOUT = '5s';

class TypeOrmPostingTransaction implements PostingTransaction {
  constructor(private readonly manager: EntityManager) {}

  async lockAccount(accountId: string): Promise<Account | null> {
    const row = await this.manager
      .getRepository(AccountOrmEntity)
      .createQueryBuilder('a')
      .setLock('pessimistic_write') // SELECT … FOR UPDATE
      .where('a.id = :accountId', { accountId })
      .getOne();
    return row ? toDomainAccount(row) : null;
  }

  async findEntryByIdempotencyKey(
    accountId: string,
    key: string,
  ): Promise<LedgerEntry | null> {
    const row = await this.manager
      .getRepository(LedgerEntryOrmEntity)
      .findOneBy({ accountId, idempotencyKey: key });
    return row ? toDomainEntry(row) : null;
  }

  async insertEntry(entry: NewLedgerEntry): Promise<LedgerEntry> {
    try {
      const rows: LedgerEntry[] = await this.manager.query(
        `INSERT INTO ledger_entries
           (account_id, type, amount, balance_after, description, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${ENTRY_COLUMNS}`,
        [
          entry.accountId,
          entry.type,
          entry.amount,
          entry.balanceAfter,
          entry.description,
          entry.idempotencyKey,
        ],
      );
      return rows[0];
    } catch (error) {
      // Defence in depth: the account lock already serializes same-key retries.
      if (isUniqueViolation(error, 'ledger_entries_idempotency_uq')) {
        throw new IdempotencyConflictError();
      }
      throw error;
    }
  }

  async updateBalance(accountId: string, balance: string): Promise<number> {
    const result = await this.manager
      .createQueryBuilder()
      .update(AccountOrmEntity)
      .set({
        balance,
        version: () => 'version + 1',
        updatedAt: () => 'now()',
      })
      .where('id = :accountId', { accountId })
      .returning('version')
      .execute();
    const [row] = result.raw as { version: number }[];
    return row.version;
  }
}

@Injectable()
export class TypeOrmLedgerUnitOfWork extends LedgerUnitOfWork {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  run<T>(work: (tx: PostingTransaction) => Promise<T>): Promise<T> {
    // READ COMMITTED + an explicit row lock: after the lock is granted, each
    // following statement sees the latest committed balance and entries.
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await manager.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
      return work(new TypeOrmPostingTransaction(manager));
    });
  }
}
