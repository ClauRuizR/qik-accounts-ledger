import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../common/errors/postgres-errors.js';
import type { Account } from '../domain/account.js';
import { AccountNumberTakenError } from '../domain/account.errors.js';
import {
  AccountRepository,
  type NewAccount,
} from '../domain/account.repository.js';
import { toDomainAccount } from './account.mapper.js';
import { AccountOrmEntity } from './account.orm-entity.js';

@Injectable()
export class TypeOrmAccountRepository extends AccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accounts: Repository<AccountOrmEntity>,
  ) {
    super();
  }

  async create(account: NewAccount): Promise<Account> {
    try {
      const saved = await this.accounts.save(this.accounts.create(account));
      // Re-read so DB defaults (balance "0.00", timestamps) come back exactly as stored.
      return toDomainAccount(
        await this.accounts.findOneByOrFail({ id: saved.id }),
      );
    } catch (error) {
      if (isUniqueViolation(error, 'accounts_account_number_uq')) {
        throw new AccountNumberTakenError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.accounts.findOneBy({ id });
    return row ? toDomainAccount(row) : null;
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const rows = await this.accounts.find({
      where: { userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toDomainAccount);
  }
}
