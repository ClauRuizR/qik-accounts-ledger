import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `now()` is the *transaction start* time. A posting that waits on the
 * account row lock could therefore get an earlier created_at than an entry
 * committed before it, making date-ordered history disagree with the
 * balance_after sequence. `clock_timestamp()` is evaluated at insert time —
 * while the account lock is held — so per-account date order matches
 * posting order.
 */
export class LedgerEntryInsertTimestamp1762990000000 implements MigrationInterface {
  name = 'LedgerEntryInsertTimestamp1762990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ledger_entries ALTER COLUMN created_at SET DEFAULT clock_timestamp()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ledger_entries ALTER COLUMN created_at SET DEFAULT now()`,
    );
  }
}
