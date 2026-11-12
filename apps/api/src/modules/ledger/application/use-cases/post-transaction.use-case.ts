import { Injectable, Logger } from '@nestjs/common';
import {
  AccountInactiveError,
  AccountNotFoundError,
} from '../../../accounts/domain/account.errors.js';
import { IdempotencyConflictError } from '../../domain/ledger.errors.js';
import type {
  LedgerEntry,
  TransactionType,
} from '../../domain/ledger-entry.js';
import { Money } from '../../domain/money.js';
import { applyPosting, isSamePosting } from '../../domain/posting.js';
import { LedgerEvents } from '../ports/ledger-events.js';
import { LedgerUnitOfWork } from '../ports/ledger-unit-of-work.js';

export interface PostTransactionCommand {
  userId: string;
  accountId: string;
  type: TransactionType;
  /** Decimal string as received from the client. */
  amount: string;
  description?: string | null;
  idempotencyKey?: string | null;
}

export interface PostTransactionResult {
  entry: LedgerEntry;
  /** True when an earlier identical request was returned instead of posting again. */
  replayed: boolean;
}

/**
 * Posts a CREDIT or DEBIT atomically:
 *   lock account row → authorize → idempotency check → compute new balance
 *   → insert ledger entry → update balance → commit.
 * Any failure rolls back both the entry and the balance update.
 */
@Injectable()
export class PostTransactionUseCase {
  private readonly logger = new Logger(PostTransactionUseCase.name);

  constructor(
    private readonly unitOfWork: LedgerUnitOfWork,
    private readonly events: LedgerEvents,
  ) {}

  async execute(
    command: PostTransactionCommand,
  ): Promise<PostTransactionResult> {
    // Validate before opening a transaction or taking any lock.
    const amount = Money.transactionAmount(command.amount);
    const description = command.description?.trim() ?? '';
    const idempotencyKey = command.idempotencyKey ?? null;

    const result = await this.unitOfWork.run(async (tx) => {
      const account = await tx.lockAccount(command.accountId);
      if (!account || !account.isOwnedBy(command.userId))
        throw new AccountNotFoundError();
      if (!account.isActive) throw new AccountInactiveError();

      // Checked while holding the account lock, so concurrent retries with the
      // same key are serialized and only the first one posts.
      if (idempotencyKey) {
        const existing = await tx.findEntryByIdempotencyKey(
          account.id,
          idempotencyKey,
        );
        if (existing) {
          if (
            !isSamePosting(existing, {
              type: command.type,
              amount,
              description,
            })
          ) {
            throw new IdempotencyConflictError();
          }
          return { entry: existing, replayed: true };
        }
      }

      const newBalance = applyPosting(
        Money.of(account.balance),
        command.type,
        amount,
      );
      const entry = await tx.insertEntry({
        accountId: account.id,
        type: command.type,
        amount: amount.toString(),
        balanceAfter: newBalance.toString(),
        description,
        idempotencyKey,
      });
      await tx.updateBalance(account.id, newBalance.toString());
      return { entry, replayed: false };
    });

    if (!result.replayed) await this.notifyCommitted(command.accountId);
    return result;
  }

  private async notifyCommitted(accountId: string): Promise<void> {
    try {
      await this.events.postingCommitted(accountId);
    } catch (error) {
      // The posting is committed; a stale derived view must not fail the request.
      this.logger.warn(
        `postingCommitted hook failed for ${accountId}: ${String(error)}`,
      );
    }
  }
}
