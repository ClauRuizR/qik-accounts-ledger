import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../../../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../../../common/auth/current-user.decorator.js';
import { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case.js';
import { GetAccountBalanceUseCase } from '../../application/use-cases/get-account-balance.use-case.js';
import { GetOwnedAccountUseCase } from '../../application/use-cases/get-owned-account.use-case.js';
import { ListMyAccountsUseCase } from '../../application/use-cases/list-my-accounts.use-case.js';
import {
  AccountBalanceType,
  AccountType,
  CreateAccountInput,
} from './account.types.js';

@Resolver(() => AccountType)
export class AccountsResolver {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly listMyAccountsUseCase: ListMyAccountsUseCase,
    private readonly getOwnedAccountUseCase: GetOwnedAccountUseCase,
    private readonly getAccountBalanceUseCase: GetAccountBalanceUseCase,
  ) {}

  @Query(() => [AccountType], {
    description: "The authenticated user's accounts.",
  })
  async myAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountType[]> {
    const accounts = await this.listMyAccountsUseCase.execute(user.id);
    return accounts.map((a) => a.toProps());
  }

  @Query(() => AccountType)
  async account(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }, new ParseUUIDPipe()) id: string,
  ): Promise<AccountType> {
    return (await this.getOwnedAccountUseCase.execute(user.id, id)).toProps();
  }

  @Query(() => AccountBalanceType)
  accountBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Args('accountId', { type: () => ID }, new ParseUUIDPipe())
    accountId: string,
  ): Promise<AccountBalanceType> {
    return this.getAccountBalanceUseCase.execute(user.id, accountId);
  }

  // `input` is declared optional rather than `| null`: a union type emits `Object` as
  // design:type, which makes the global ValidationPipe silently skip validation.
  @Mutation(() => AccountType)
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input', { type: () => CreateAccountInput, nullable: true })
    input?: CreateAccountInput,
  ): Promise<AccountType> {
    const account = await this.createAccountUseCase.execute({
      userId: user.id,
      currency: input?.currency,
    });
    return account.toProps();
  }
}
