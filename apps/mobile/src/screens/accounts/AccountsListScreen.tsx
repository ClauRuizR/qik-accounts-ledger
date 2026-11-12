import { useLayoutEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AccountCard } from '../../components/accounts/AccountCard';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { EmptyState, ErrorBanner, ErrorState, LoadingState } from '../../components/common/States';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../hooks/useAuth';
import type { AppScreenProps } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

export function AccountsListScreen({ navigation }: AppScreenProps<'Accounts'>) {
  const { signOut } = useAuth();
  const { accounts, loading, error, refreshing, refresh } = useAccounts();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.headerAction}>Sign out</Text>
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  const createAccount = () => navigation.navigate('CreateAccount');

  if (loading) return <LoadingState message="Loading your accounts…" />;
  if (!accounts) {
    return <ErrorState message={error ?? 'Could not load accounts.'} onRetry={refresh} />;
  }

  return (
    <Screen>
      <FlatList
        data={accounts}
        keyExtractor={(account) => account.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={error ? <ErrorBanner message={error} /> : undefined}
        ListEmptyComponent={
          <EmptyState
            title="No accounts yet"
            message="Open your first account to start receiving and sending money."
            actionTitle="Open an account"
            onAction={createAccount}
          />
        }
        renderItem={({ item }) => (
          <AccountCard
            account={item}
            onPress={() => navigation.navigate('AccountDetails', { accountId: item.id })}
          />
        )}
      />
      {accounts.length > 0 ? (
        <View style={styles.footer}>
          <Button title="Open a new account" onPress={createAccount} testID="open-account" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { padding: spacing.lg, paddingTop: 0 },
  headerAction: { ...typography.label, color: colors.primary },
});
