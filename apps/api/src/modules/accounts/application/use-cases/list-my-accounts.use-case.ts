import { Injectable } from '@nestjs/common';
import type { Account } from '../../domain/account.js';
import { AccountRepository } from '../../domain/account.repository.js';

@Injectable()
export class ListMyAccountsUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  execute(userId: string): Promise<Account[]> {
    return this.accounts.findByUserId(userId);
  }
}
