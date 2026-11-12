import type { DataSource } from 'typeorm';

/**
 * Empties all tables between tests. Ledger entries are append-only (a trigger
 * blocks UPDATE/DELETE/TRUNCATE), so triggers are bypassed for this session
 * with `session_replication_role = replica` — a test-only escape hatch that
 * requires a superuser role, which the local docker-compose user is.
 */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(`SET LOCAL session_replication_role = replica`);
    await manager.query(
      `TRUNCATE ledger_entries, accounts, users RESTART IDENTITY`,
    );
  });
}
