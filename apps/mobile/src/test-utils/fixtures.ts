import { CombinedGraphQLErrors } from '@apollo/client';
import type { Account, BalanceSummary, Transaction } from '../types/models';

/** Fixtures carry __typename because Apollo's cache adds it to every selection. */
export const account = (overrides: Partial<Account> = {}): Account & { __typename: 'Account' } => ({
  __typename: 'Account',
  id: 'acc-1',
  accountNumber: '100000000008',
  currency: 'DOP',
  balance: '1500.50',
  status: 'ACTIVE',
  createdAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});

export const transaction = (
  overrides: Partial<Transaction> = {},
): Transaction & { __typename: 'Transaction' } => ({
  __typename: 'Transaction',
  id: 'tx-1',
  type: 'CREDIT',
  amount: '100.00',
  balanceAfter: '100.00',
  description: 'Salary',
  createdAt: '2026-11-10T15:30:00.000Z',
  ...overrides,
});

export const connection = (
  items: Transaction[],
  { hasNextPage = false, endCursor = null as string | null, totalCount = items.length } = {},
) => ({
  __typename: 'TransactionConnection' as const,
  items: items.map((t) => ({ __typename: 'Transaction' as const, ...t })),
  pageInfo: { __typename: 'PageInfo' as const, hasNextPage, endCursor },
  totalCount,
});

export const summary = (overrides: Partial<BalanceSummary> = {}) => ({
  __typename: 'BalanceSummary' as const,
  accountId: 'acc-1',
  currency: 'DOP' as const,
  currentBalance: '150.00',
  totalCredits: '200.00',
  totalDebits: '50.00',
  transactionCount: 3,
  history: [
    { __typename: 'BalancePoint' as const, at: '2026-11-01T12:00:00.000Z', balance: '100.00' },
    { __typename: 'BalancePoint' as const, at: '2026-11-02T12:00:00.000Z', balance: '200.00' },
    { __typename: 'BalancePoint' as const, at: '2026-11-03T12:00:00.000Z', balance: '150.00' },
  ],
  ...overrides,
});

/** A GraphQL error response as the API returns it. */
export const apiError = (code: string, message = code) =>
  new CombinedGraphQLErrors({ errors: [{ message, extensions: { code } }] });

export const graphQLErrorResult = (code: string, message = code) => ({
  errors: [{ message, extensions: { code } }],
});
