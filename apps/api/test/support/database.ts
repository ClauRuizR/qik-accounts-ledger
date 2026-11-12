import type { DataSource } from 'typeorm';
import type { RedisCacheStore } from '../../src/common/cache/redis-cache-store.js';

/**
 * Empties all tables (and the test Redis database) between tests. Ledger
 * entries are append-only (a trigger blocks UPDATE/DELETE/TRUNCATE), so
 * triggers are bypassed for this session with
 * `session_replication_role = replica` — a test-only escape hatch that
 * requires a superuser role, which the local docker-compose user is.
 */
export async function resetDatabase(
  dataSource: DataSource,
  cache?: RedisCacheStore,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(`SET LOCAL session_replication_role = replica`);
    await manager.query(
      `TRUNCATE ledger_entries, accounts, users RESTART IDENTITY`,
    );
  });
  await cache?.flush();
}

export interface SeedEntry {
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  /** ISO timestamp; lets tests control created_at for date-filter scenarios. */
  at: string;
}

/**
 * Inserts ledger entries with explicit timestamps, computing balance_after
 * exactly (integer cents) and setting the account balance/version to match,
 * so the ledger invariants still hold.
 */
export async function seedLedger(
  dataSource: DataSource,
  accountId: string,
  entries: SeedEntry[],
): Promise<void> {
  const cents = (v: string) => BigInt(v.replace('.', ''));
  const fmt = (c: bigint) => `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;
  let balance = 0n;
  await dataSource.transaction(async (manager) => {
    for (const e of entries) {
      balance += e.type === 'CREDIT' ? cents(e.amount) : -cents(e.amount);
      if (balance < 0n)
        throw new Error('seedLedger: sequence overdraws the account');
      await manager.query(
        `INSERT INTO ledger_entries (account_id, type, amount, balance_after, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          accountId,
          e.type,
          e.amount,
          fmt(balance),
          `${e.type} ${e.amount}`,
          e.at,
        ],
      );
    }
    await manager.query(
      `UPDATE accounts SET balance = $2, version = version + $3 WHERE id = $1`,
      [accountId, fmt(balance), entries.length],
    );
  });
}
