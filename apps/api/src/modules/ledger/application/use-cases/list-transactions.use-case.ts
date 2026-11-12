import { Injectable } from '@nestjs/common';
import { GetOwnedAccountUseCase } from '../../../accounts/application/use-cases/get-owned-account.use-case.js';
import type { TransactionType } from '../../domain/ledger-entry.js';
import {
  assertValidDateRange,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  type LedgerEntryWithPosition,
  MAX_PAGE_SIZE,
  type SortOrder,
} from '../../domain/transaction-query.js';
import { LedgerReadRepository } from '../ports/ledger-read.repository.js';

export interface ListTransactionsCommand {
  userId: string;
  accountId: string;
  type?: TransactionType | null;
  startDate?: Date | null;
  endDate?: Date | null;
  first?: number | null;
  after?: string | null;
  sortOrder?: SortOrder | null;
}

export interface TransactionConnection {
  items: LedgerEntryWithPosition[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}

@Injectable()
export class ListTransactionsUseCase {
  constructor(
    private readonly getOwnedAccount: GetOwnedAccountUseCase,
    private readonly ledger: LedgerReadRepository,
  ) {}

  async execute(
    command: ListTransactionsCommand,
  ): Promise<TransactionConnection> {
    assertValidDateRange(
      command.startDate ?? undefined,
      command.endDate ?? undefined,
    );
    const after = command.after ? decodeCursor(command.after) : undefined;
    const limit = Math.min(
      Math.max(command.first ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    // Authorization before any ledger data is read.
    const account = await this.getOwnedAccount.execute(
      command.userId,
      command.accountId,
    );

    const page = await this.ledger.findTransactions({
      accountId: account.id,
      type: command.type ?? undefined,
      startDate: command.startDate ?? undefined,
      endDate: command.endDate ?? undefined,
      limit,
      after,
      sortOrder: command.sortOrder ?? 'DESC',
    });

    const last = page.items.at(-1);
    return {
      items: page.items,
      pageInfo: {
        hasNextPage: page.hasNextPage,
        endCursor: last ? encodeCursor(last.position) : null,
      },
      totalCount: page.totalCount,
    };
  }
}
