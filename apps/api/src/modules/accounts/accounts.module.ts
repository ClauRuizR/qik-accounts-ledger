import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case.js';
import { GetAccountBalanceUseCase } from './application/use-cases/get-account-balance.use-case.js';
import { GetOwnedAccountUseCase } from './application/use-cases/get-owned-account.use-case.js';
import { ListMyAccountsUseCase } from './application/use-cases/list-my-accounts.use-case.js';
import { AccountNumberGenerator } from './domain/account-number.generator.js';
import { AccountRepository } from './domain/account.repository.js';
import { AccountOrmEntity } from './infrastructure/account.orm-entity.js';
import { CryptoAccountNumberGenerator } from './infrastructure/crypto-account-number.generator.js';
import { TypeOrmAccountRepository } from './infrastructure/typeorm-account.repository.js';
import { AccountsResolver } from './presentation/graphql/accounts.resolver.js';

@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  providers: [
    { provide: AccountRepository, useClass: TypeOrmAccountRepository },
    { provide: AccountNumberGenerator, useClass: CryptoAccountNumberGenerator },
    CreateAccountUseCase,
    ListMyAccountsUseCase,
    GetOwnedAccountUseCase,
    GetAccountBalanceUseCase,
    AccountsResolver,
  ],
  exports: [GetOwnedAccountUseCase],
})
export class AccountsModule {}
