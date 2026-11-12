import { type ReactElement, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { EmptyState, ErrorBanner, ErrorState, LoadingState } from '../../components/common/States';
import { TransactionFilters } from '../../components/transactions/TransactionFilters';
import { TransactionRow } from '../../components/transactions/TransactionRow';
import { useAccount } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import type { AppScreenProps } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import type { TransactionFilters as Filters } from '../../types/models';

const DEFAULT_FILTERS: Filters = { sortOrder: 'DESC' };

const isFiltered = (f: Filters) => Boolean(f.type || f.startDate || f.endDate);

export function TransactionHistoryScreen({ route }: AppScreenProps<'TransactionHistory'>) {
  const { accountId } = route.params;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const { account } = useAccount(accountId);
  const { transactions, totalCount, loading, loadingMore, refreshing, error, loadMore, refresh } =
    useTransactions(accountId, filters);

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setShowFilters(false);
  };

  const currency = account?.currency ?? 'DOP';

  const header = (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowFilters((v) => !v)}
        style={styles.toggle}
        testID="toggle-filters"
      >
        <Text style={styles.toggleText}>
          {showFilters ? 'Hide filters' : isFiltered(filters) ? 'Filters (active)' : 'Filters'}
        </Text>
        {transactions ? (
          <Text style={styles.count}>
            {totalCount} {totalCount === 1 ? 'transaction' : 'transactions'}
          </Text>
        ) : null}
      </Pressable>
      {showFilters ? <TransactionFilters onApply={applyFilters} /> : null}
      {error && transactions ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
    </View>
  );

  let body: ReactElement | null = null;
  if (loading) body = <LoadingState message="Loading transactions…" />;
  else if (!transactions) {
    body = <ErrorState message={error ?? 'Could not load transactions.'} onRetry={refresh} />;
  }

  return (
    <Screen>
      {body ? (
        <>
          {header}
          {body}
        </>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <TransactionRow transaction={item} currency={currency} />}
          ItemSeparatorComponent={Separator}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            isFiltered(filters) ? (
              <EmptyState
                title="No matching transactions"
                message="Try a different type or date range."
                actionTitle="Clear filters"
                onAction={() => applyFilters(DEFAULT_FILTERS)}
              />
            ) : (
              <EmptyState
                title="No transactions yet"
                message="Credits and debits on this account will appear here."
              />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={styles.footer}
                color={colors.primary}
                testID="loading-more"
              />
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toggleText: { ...typography.label, color: colors.primary },
  count: { ...typography.caption, color: colors.textMuted },
  banner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: { padding: spacing.lg },
});
