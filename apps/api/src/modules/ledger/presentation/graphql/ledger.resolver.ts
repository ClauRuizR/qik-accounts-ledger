import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../../../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../../../common/auth/current-user.decorator.js';
import { PostTransactionUseCase } from '../../application/use-cases/post-transaction.use-case.js';
import type { TransactionType } from '../../domain/ledger-entry.js';
import { PostTransactionInput, TransactionGqlType } from './ledger.types.js';

@Resolver(() => TransactionGqlType)
export class LedgerResolver {
  constructor(private readonly postTransaction: PostTransactionUseCase) {}

  @Mutation(() => TransactionGqlType, {
    description: 'Increases the account balance.',
  })
  creditAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: PostTransactionInput,
  ): Promise<TransactionGqlType> {
    return this.post(user, input, 'CREDIT');
  }

  @Mutation(() => TransactionGqlType, {
    description:
      'Decreases the account balance. Fails with INSUFFICIENT_FUNDS on overdraft.',
  })
  debitAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: PostTransactionInput,
  ): Promise<TransactionGqlType> {
    return this.post(user, input, 'DEBIT');
  }

  private async post(
    user: AuthenticatedUser,
    input: PostTransactionInput,
    type: TransactionType,
  ): Promise<TransactionGqlType> {
    const { entry } = await this.postTransaction.execute({
      userId: user.id,
      type,
      ...input,
    });
    return entry;
  }
}
