import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AccountStatus } from '../domain/account.js';
import type { Currency } from '../domain/currency.js';

@Entity({ name: 'accounts' })
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'account_number', type: 'varchar', length: 12 })
  accountNumber: string;

  @Column({ type: 'char', length: 3 })
  currency: Currency;

  /** pg returns NUMERIC as a string — kept as a string end to end. */
  @Column({ type: 'numeric', precision: 20, scale: 2, default: '0' })
  balance: string;

  @Column({ type: 'varchar', length: 8, default: 'ACTIVE' })
  status: AccountStatus;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
