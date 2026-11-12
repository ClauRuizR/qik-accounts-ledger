import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TransactionType } from '../domain/ledger-entry.js';

/** Append-only: the database rejects UPDATE/DELETE on this table (trigger). */
@Entity({ name: 'ledger_entries' })
export class LedgerEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** bigint identity — pg returns it as a string. */
  @Column({ type: 'bigint', insert: false, update: false })
  seq: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'varchar', length: 6 })
  type: TransactionType;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 20, scale: 2 })
  balanceAfter: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
