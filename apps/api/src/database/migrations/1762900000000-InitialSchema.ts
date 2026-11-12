import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for users, accounts and the append-only ledger.
 *
 * Financial invariants enforced at the database level (defence in depth —
 * the application enforces them too):
 *  - balances and amounts are NUMERIC, never floating point;
 *  - an account balance can never be negative (no overdraft);
 *  - ledger amounts are strictly positive;
 *  - an idempotency key is unique per account;
 *  - posted ledger entries can never be updated or deleted.
 */
export class InitialSchema1762900000000 implements MigrationInterface {
  name = 'InitialSchema1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(254) NOT NULL,
        password_hash text         NOT NULL,
        created_at    timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email))`,
    );

    await queryRunner.query(`
      CREATE TABLE accounts (
        id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        uuid          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        account_number varchar(12)   NOT NULL,
        currency       char(3)       NOT NULL,
        balance        numeric(20,2) NOT NULL DEFAULT 0,
        status         varchar(8)    NOT NULL DEFAULT 'ACTIVE',
        version        integer       NOT NULL DEFAULT 0,
        created_at     timestamptz   NOT NULL DEFAULT now(),
        updated_at     timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT accounts_account_number_uq UNIQUE (account_number),
        CONSTRAINT accounts_currency_ck CHECK (currency IN ('DOP', 'USD', 'EUR')),
        CONSTRAINT accounts_status_ck CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT accounts_balance_non_negative_ck CHECK (balance >= 0),
        CONSTRAINT accounts_version_non_negative_ck CHECK (version >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX accounts_user_id_idx ON accounts (user_id, created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE ledger_entries (
        id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        seq             bigint        GENERATED ALWAYS AS IDENTITY,
        account_id      uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        type            varchar(6)    NOT NULL,
        amount          numeric(20,2) NOT NULL,
        balance_after   numeric(20,2) NOT NULL,
        description     varchar(255)  NOT NULL DEFAULT '',
        idempotency_key varchar(64)   NULL,
        created_at      timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT ledger_entries_seq_uq UNIQUE (seq),
        CONSTRAINT ledger_entries_type_ck CHECK (type IN ('CREDIT', 'DEBIT')),
        CONSTRAINT ledger_entries_amount_positive_ck CHECK (amount > 0),
        CONSTRAINT ledger_entries_balance_after_non_negative_ck CHECK (balance_after >= 0),
        CONSTRAINT ledger_entries_idempotency_uq UNIQUE (account_id, idempotency_key)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ledger_entries_account_created_idx ON ledger_entries (account_id, created_at DESC, seq DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX ledger_entries_account_type_created_idx ON ledger_entries (account_id, type, created_at DESC, seq DESC)`,
    );

    // Posted ledger entries are immutable.
    await queryRunner.query(`
      CREATE FUNCTION ledger_entries_immutable() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_entries are append-only: % is not allowed', TG_OP
          USING ERRCODE = 'restrict_violation';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER ledger_entries_no_update_delete
      BEFORE UPDATE OR DELETE ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable()
    `);
    await queryRunner.query(`
      CREATE TRIGGER ledger_entries_no_truncate
      BEFORE TRUNCATE ON ledger_entries
      FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_immutable()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE ledger_entries`);
    await queryRunner.query(`DROP FUNCTION ledger_entries_immutable()`);
    await queryRunner.query(`DROP TABLE accounts`);
    await queryRunner.query(`DROP TABLE users`);
  }
}
