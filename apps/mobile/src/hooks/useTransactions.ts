import { useQuery } from '@apollo/client/react';
import { useCallback, useState } from 'react';
import { useRefresh } from './useRefresh';
import { getErrorMessage } from '../services/graphql/errors';
import { ACCOUNT_TRANSACTIONS } from '../services/graphql/operations';
import type { TransactionConnection, TransactionFilters } from '../types/models';

export const PAGE_SIZE = 20;

interface Variables {
  accountId: string;
  filters: TransactionFilters & { first: number; after?: string };
}

/** Filterable, cursor-paginated transaction history (infinite scroll). */
export function useTransactions(accountId: string, filters: TransactionFilters) {
  const [loadingMore, setLoadingMore] = useState(false);
  const { data, loading, error, fetchMore, refetch } = useQuery<
    { accountTransactions: TransactionConnection },
    Variables
  >(ACCOUNT_TRANSACTIONS, {
    variables: { accountId, filters: { ...filters, first: PAGE_SIZE } },
    fetchPolicy: 'cache-and-network',
  });

  const connection = data?.accountTransactions;
  const hasNextPage = connection?.pageInfo.hasNextPage ?? false;
  const endCursor = connection?.pageInfo.endCursor ?? undefined;

  const loadMore = useCallback(async () => {
    if (!hasNextPage || !endCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchMore({
        variables: { accountId, filters: { ...filters, first: PAGE_SIZE, after: endCursor } },
      });
    } catch {
      // Keep the loaded pages; the user can scroll again to retry.
    } finally {
      setLoadingMore(false);
    }
  }, [accountId, endCursor, fetchMore, filters, hasNextPage, loadingMore]);

  const { refreshing, refresh } = useRefresh(refetch);

  return {
    transactions: connection?.items,
    totalCount: connection?.totalCount ?? 0,
    hasNextPage,
    loading: loading && !data,
    loadingMore,
    refreshing,
    error: error ? getErrorMessage(error) : null,
    loadMore,
    refresh,
  };
}
