import { useQuery } from '@apollo/client/react';
import { useRefresh } from './useRefresh';
import { getErrorMessage } from '../services/graphql/errors';
import { BALANCE_SUMMARY } from '../services/graphql/operations';
import type { BalanceSummary } from '../types/models';

export const HISTORY_POINTS = 14;

export function useBalanceSummary(accountId: string) {
  const { data, loading, error, refetch } = useQuery<
    { accountBalanceSummary: BalanceSummary },
    { accountId: string; historyLimit: number }
  >(BALANCE_SUMMARY, {
    variables: { accountId, historyLimit: HISTORY_POINTS },
    fetchPolicy: 'cache-and-network',
  });

  const { refreshing, refresh } = useRefresh(refetch);

  return {
    summary: data?.accountBalanceSummary,
    loading: loading && !data,
    error: error ? getErrorMessage(error) : null,
    refreshing,
    refresh,
  };
}
