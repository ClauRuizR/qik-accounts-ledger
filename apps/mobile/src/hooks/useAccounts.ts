import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { getErrorMessage } from '../services/graphql/errors';
import { ACCOUNT, CREATE_ACCOUNT, MY_ACCOUNTS } from '../services/graphql/operations';
import type { Account, Currency } from '../types/models';
import { useRefresh } from './useRefresh';

export function useAccounts() {
  const { data, loading, error, refetch } = useQuery<{ myAccounts: Account[] }>(MY_ACCOUNTS, {
    fetchPolicy: 'cache-and-network',
  });
  const { refreshing, refresh } = useRefresh(refetch);
  return {
    accounts: data?.myAccounts,
    loading: loading && !data,
    error: error ? getErrorMessage(error) : null,
    refreshing,
    refresh,
  };
}

export function useAccount(id: string) {
  const { data, loading, error, refetch } = useQuery<{ account: Account }, { id: string }>(
    ACCOUNT,
    { variables: { id }, fetchPolicy: 'cache-and-network' },
  );
  const { refreshing, refresh } = useRefresh(refetch);
  return {
    account: data?.account,
    loading: loading && !data,
    error: error ? getErrorMessage(error) : null,
    refreshing,
    refresh,
  };
}

export function useCreateAccount() {
  const [error, setError] = useState<string | null>(null);
  const [mutate, { loading }] = useMutation<
    { createAccount: Account },
    { input: { currency: Currency } }
  >(CREATE_ACCOUNT, { refetchQueries: ['MyAccounts'] });

  const create = async (currency: Currency): Promise<Account | null> => {
    setError(null);
    try {
      const { data } = await mutate({ variables: { input: { currency } } });
      return data?.createAccount ?? null;
    } catch (e) {
      setError(getErrorMessage(e));
      return null;
    }
  };

  return { create, loading, error };
}
