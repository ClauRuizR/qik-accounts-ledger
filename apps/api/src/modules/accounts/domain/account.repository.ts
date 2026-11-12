import type { Account } from './account.js';
import type { Currency } from './currency.js';

export interface NewAccount {
  userId: string;
  accountNumber: string;
  currency: Currency;
}

/** Persistence port for accounts. */
export abstract class AccountRepository {
  /** @throws AccountNumberTakenError on an account-number collision. */
  abstract create(account: NewAccount): Promise<Account>;
  abstract findById(id: string): Promise<Account | null>;
  /** Ordered by creation date, oldest first. */
  abstract findByUserId(userId: string): Promise<Account[]>;
}
