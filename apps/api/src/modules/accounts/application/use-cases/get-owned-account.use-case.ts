import { Injectable } from '@nestjs/common';
import type { Account } from '../../domain/account.js';
import { AccountNotFoundError } from '../../domain/account.errors.js';
import { AccountRepository } from '../../domain/account.repository.js';

/**
 * Loads an account and enforces ownership. The single authorization check for
 * account-scoped reads; other modules (ledger) reuse it.
 */
@Injectable()
export class GetOwnedAccountUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(userId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findById(accountId);
    if (!account || !account.isOwnedBy(userId))
      throw new AccountNotFoundError();
    return account;
  }
}
