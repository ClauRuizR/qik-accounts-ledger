import { InsufficientFundsError, InvalidAmountError } from './ledger.errors.js';
import type { TransactionType } from './ledger-entry.js';
import { Money } from './money.js';

/**
 * Core ledger rule: computes the balance after applying a posting.
 * Pure function — no I/O, no framework.
 *
 * @throws InsufficientFundsError when a debit would overdraw the account.
 */
export function applyPosting(
  balance: Money,
  type: TransactionType,
  amount: Money,
): Money {
  const next = type === 'CREDIT' ? balance.plus(amount) : balance.minus(amount);
  if (next.isNegative()) throw new InsufficientFundsError();
  if (next.exceedsStorableRange()) {
    throw new InvalidAmountError(
      'Resulting balance exceeds the maximum supported balance',
    );
  }
  return next;
}

/** Whether a stored entry matches a retried request with the same idempotency key. */
export function isSamePosting(
  entry: { type: TransactionType; amount: string; description: string },
  request: { type: TransactionType; amount: Money; description: string },
): boolean {
  return (
    entry.type === request.type &&
    Money.of(entry.amount).equals(request.amount) &&
    entry.description === request.description
  );
}
