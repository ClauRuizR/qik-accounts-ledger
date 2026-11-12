import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh state, kept separate from the initial load so a refresh
 * never replaces visible content with a spinner. Failures surface through the
 * query's own error state while cached data stays on screen.
 */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // reported by the query's error state
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, refresh };
}
