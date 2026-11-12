import type { Currency } from './currency.js';

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface AccountProps {
  id: string;
  userId: string;
  accountNumber: string;
  currency: Currency;
  /** Decimal string with 2 fraction digits, e.g. "100.00". Never a JS number. */
  balance: string;
  status: AccountStatus;
  /** Incremented on every posting; used to version cached read models. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Account {
  constructor(private readonly props: AccountProps) {}

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get accountNumber(): string {
    return this.props.accountNumber;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get balance(): string {
    return this.props.balance;
  }
  get status(): AccountStatus {
    return this.props.status;
  }
  get version(): number {
    return this.props.version;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }

  toProps(): AccountProps {
    return { ...this.props };
  }
}
