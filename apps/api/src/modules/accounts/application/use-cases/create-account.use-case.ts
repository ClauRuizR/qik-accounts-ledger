import { Injectable } from '@nestjs/common';
import type { Account } from '../../domain/account.js';
import { AccountNumberTakenError } from '../../domain/account.errors.js';
import { AccountNumberGenerator } from '../../domain/account-number.generator.js';
import { AccountRepository } from '../../domain/account.repository.js';
import { type Currency, DEFAULT_CURRENCY } from '../../domain/currency.js';

export interface CreateAccountCommand {
  userId: string;
  currency?: Currency;
}

/** 10^11 possible numbers: a collision is rare, several in a row are not expected. */
const MAX_ATTEMPTS = 5;

@Injectable()
export class CreateAccountUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly numbers: AccountNumberGenerator,
  ) {}

  async execute(command: CreateAccountCommand): Promise<Account> {
    const currency = command.currency ?? DEFAULT_CURRENCY;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.accounts.create({
          userId: command.userId,
          currency,
          accountNumber: this.numbers.generate(),
        });
      } catch (error) {
        if (error instanceof AccountNumberTakenError && attempt < MAX_ATTEMPTS)
          continue;
        throw error;
      }
    }
  }
}
