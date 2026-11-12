import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { AuthenticatedUser } from '../../../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../../../common/auth/current-user.decorator.js';
import { GetBalanceSummaryUseCase } from '../../application/use-cases/get-balance-summary.use-case.js';
import { ListTransactionsUseCase } from '../../application/use-cases/list-transactions.use-case.js';
import { MAX_HISTORY_POINTS } from '../../domain/balance-summary.js';
import {
  BalancePoint,
  BalanceSummary,
  TransactionConnection,
  TransactionFilterInput,
} from './ledger-queries.types.js';

@Resolver(() => BalanceSummary)
export class LedgerQueriesResolver {
  constructor(
    private readonly listTransactions: ListTransactionsUseCase,
    private readonly getBalanceSummary: GetBalanceSummaryUseCase,
  ) {}

  // `filters` is declared optional rather than `| null`: a union type emits `Object` as
  // design:type, which makes the global ValidationPipe silently skip validation.
  @Query(() => TransactionConnection, {
    description:
      'Paginated, filterable transaction history of an owned account.',
  })
  accountTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Args('accountId', { type: () => ID }, new ParseUUIDPipe())
    accountId: string,
    @Args('filters', { type: () => TransactionFilterInput, nullable: true })
    filters?: TransactionFilterInput,
  ): Promise<TransactionConnection> {
    return this.listTransactions.execute({
      userId: user.id,
      accountId,
      ...filters,
    });
  }

  @Query(() => BalanceSummary, {
    description:
      'Current balance, totals and recent balance history (cached in Redis).',
  })
  async accountBalanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Args('accountId', { type: () => ID }, new ParseUUIDPipe())
    accountId: string,
  ): Promise<BalanceSummary> {
    const { history, ...summary } = await this.getBalanceSummary.execute(
      user.id,
      accountId,
    );
    return { ...summary, allHistory: history };
  }

  @ResolveField(() => [BalancePoint], {
    description: `Most recent balance points (oldest first), up to ${MAX_HISTORY_POINTS}.`,
  })
  history(
    @Parent() summary: BalanceSummary,
    @Args('limit', { type: () => Int, defaultValue: 30 }) limit: number,
  ): BalancePoint[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_POINTS) {
      throw new BadRequestException([
        `limit must be between 1 and ${MAX_HISTORY_POINTS}`,
      ]);
    }
    return summary.allHistory.slice(-limit);
  }
}
