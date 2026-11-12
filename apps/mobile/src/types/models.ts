/** Mirrors the API's GraphQL schema. Money values are decimal strings — never numbers. */

export type Currency = 'DOP' | 'USD' | 'EUR';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type SortOrder = 'ASC' | 'DESC';

export const CURRENCIES: readonly Currency[] = ['DOP', 'USD', 'EUR'];

export interface User {
  id: string;
  email: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string;
  createdAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface TransactionConnection {
  items: Transaction[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface BalancePoint {
  at: string;
  balance: string;
}

export interface BalanceSummary {
  accountId: string;
  currency: Currency;
  currentBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  history: BalancePoint[];
}

export interface TransactionFilters {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  sortOrder: SortOrder;
}
