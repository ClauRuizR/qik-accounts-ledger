import { createCache } from '../client';
import { ACCOUNT_TRANSACTIONS } from '../operations';

const tx = (id: string) => ({
  __typename: 'Transaction',
  id,
  type: 'CREDIT',
  amount: '1.00',
  balanceAfter: '1.00',
  description: '',
  createdAt: '2026-11-12T10:00:00.000Z',
});

const page = (ids: string[], hasNextPage: boolean, endCursor: string | null) => ({
  accountTransactions: {
    __typename: 'TransactionConnection',
    items: ids.map(tx),
    pageInfo: { __typename: 'PageInfo', hasNextPage, endCursor },
    totalCount: 3,
  },
});

describe('accountTransactions cache policy', () => {
  it('appends next pages and keeps filter combinations separate', () => {
    const cache = createCache();
    const base = { accountId: 'a1', filters: { sortOrder: 'DESC', first: 2 } };

    cache.writeQuery({
      query: ACCOUNT_TRANSACTIONS,
      variables: base,
      data: page(['t1', 't2'], true, 'c2'),
    });
    cache.writeQuery({
      query: ACCOUNT_TRANSACTIONS,
      variables: { ...base, filters: { ...base.filters, after: 'c2' } },
      data: page(['t3'], false, 'c3'),
    });

    const merged = cache.readQuery<ReturnType<typeof page>>({
      query: ACCOUNT_TRANSACTIONS,
      variables: base,
    });
    expect(merged?.accountTransactions.items.map((i) => i.id)).toEqual(['t1', 't2', 't3']);
    expect(merged?.accountTransactions.pageInfo.hasNextPage).toBe(false);

    const debitsOnly = cache.readQuery({
      query: ACCOUNT_TRANSACTIONS,
      variables: { accountId: 'a1', filters: { sortOrder: 'DESC', first: 2, type: 'DEBIT' } },
    });
    expect(debitsOnly).toBeNull();
  });

  it('replaces (does not append) when a first page is fetched again', () => {
    const cache = createCache();
    const vars = { accountId: 'a1', filters: { sortOrder: 'DESC', first: 2 } };
    cache.writeQuery({
      query: ACCOUNT_TRANSACTIONS,
      variables: vars,
      data: page(['t1', 't2'], true, 'c2'),
    });
    cache.writeQuery({
      query: ACCOUNT_TRANSACTIONS,
      variables: vars,
      data: page(['t0', 't1'], true, 'c1'),
    });

    const result = cache.readQuery<ReturnType<typeof page>>({
      query: ACCOUNT_TRANSACTIONS,
      variables: vars,
    });
    expect(result?.accountTransactions.items.map((i) => i.id)).toEqual(['t0', 't1']);
  });
});
