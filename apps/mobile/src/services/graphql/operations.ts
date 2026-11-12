import { gql } from '@apollo/client';

export const ACCOUNT_FIELDS = gql`
  fragment AccountFields on Account {
    id
    accountNumber
    currency
    balance
    status
    createdAt
  }
`;

export const TRANSACTION_FIELDS = gql`
  fragment TransactionFields on Transaction {
    id
    type
    amount
    balanceAfter
    description
    createdAt
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      user {
        id
        email
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user {
        id
        email
      }
    }
  }
`;

export const MY_ACCOUNTS = gql`
  ${ACCOUNT_FIELDS}
  query MyAccounts {
    myAccounts {
      ...AccountFields
    }
  }
`;

export const ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  query Account($id: ID!) {
    account(id: $id) {
      ...AccountFields
    }
  }
`;

export const CREATE_ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  mutation CreateAccount($input: CreateAccountInput) {
    createAccount(input: $input) {
      ...AccountFields
    }
  }
`;

export const CREDIT_ACCOUNT = gql`
  ${TRANSACTION_FIELDS}
  mutation CreditAccount($input: PostTransactionInput!) {
    creditAccount(input: $input) {
      ...TransactionFields
    }
  }
`;

export const DEBIT_ACCOUNT = gql`
  ${TRANSACTION_FIELDS}
  mutation DebitAccount($input: PostTransactionInput!) {
    debitAccount(input: $input) {
      ...TransactionFields
    }
  }
`;

export const ACCOUNT_TRANSACTIONS = gql`
  ${TRANSACTION_FIELDS}
  query AccountTransactions($accountId: ID!, $filters: TransactionFilterInput) {
    accountTransactions(accountId: $accountId, filters: $filters) {
      items {
        ...TransactionFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const BALANCE_SUMMARY = gql`
  query BalanceSummary($accountId: ID!, $historyLimit: Int) {
    accountBalanceSummary(accountId: $accountId) {
      accountId
      currency
      currentBalance
      totalCredits
      totalDebits
      transactionCount
      history(limit: $historyLimit) {
        at
        balance
      }
    }
  }
`;

/** Active queries to refresh after a credit/debit so every screen shows the new balance. */
export const QUERIES_AFFECTED_BY_POSTING = [
  'Account',
  'MyAccounts',
  'AccountTransactions',
  'BalanceSummary',
];
