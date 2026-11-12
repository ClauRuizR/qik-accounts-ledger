import { Injectable } from '@nestjs/common';
import type { Currency } from '../../domain/currency.js';
import { GetOwnedAccountUseCase } from './get-owned-account.use-case.js';

export interface AccountBalance {
  accountId: string;
  balance: string;
  currency: Currency;
  asOf: Date;
}

/** Always read from PostgreSQL (the source of truth) — never cached. */
@Injectable()
export class GetAccountBalanceUseCase {
  constructor(private readonly getOwnedAccount: GetOwnedAccountUseCase) {}

  async execute(userId: string, accountId: string): Promise<AccountBalance> {
    const account = await this.getOwnedAccount.execute(userId, accountId);
    return {
      accountId: account.id,
      balance: account.balance,
      currency: account.currency,
      asOf: account.updatedAt,
    };
  }
}
