import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { MoneyText } from '../../components/common/MoneyText';
import { ErrorBanner, ErrorState, LoadingState } from '../../components/common/States';
import { useAccount } from '../../hooks/useAccounts';
import type { AppScreenProps } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { formatDate } from '../../utils/date';
import { formatAccountNumber } from '../../utils/money';

export function AccountDetailsScreen({ navigation, route }: AppScreenProps<'AccountDetails'>) {
  const { accountId } = route.params;
  const { account, loading, error, refreshing, refresh } = useAccount(accountId);

  if (loading) return <LoadingState />;
  if (!account) {
    return <ErrorState message={error ?? 'Account not found.'} onRetry={refresh} />;
  }

  const active = account.status === 'ACTIVE';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? <ErrorBanner message={error} /> : null}
        <Card>
          <Text style={styles.label}>Available balance</Text>
          <MoneyText
            amount={account.balance}
            currency={account.currency}
            size="large"
            testID="account-balance"
          />
          <Detail label="Account number" value={formatAccountNumber(account.accountNumber)} />
          <Detail label="Currency" value={account.currency} />
          <Detail label="Status" value={active ? 'Active' : 'Inactive'} />
          <Detail label="Opened" value={formatDate(account.createdAt)} />
        </Card>

        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              title="Credit"
              disabled={!active}
              onPress={() => navigation.navigate('PostTransaction', { accountId, type: 'CREDIT' })}
              testID="credit-button"
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Debit"
              disabled={!active}
              onPress={() => navigation.navigate('PostTransaction', { accountId, type: 'DEBIT' })}
              testID="debit-button"
            />
          </View>
        </View>
        <Button
          title="Transaction history"
          variant="secondary"
          onPress={() => navigation.navigate('TransactionHistory', { accountId })}
        />
        <Button
          title="Balance summary"
          variant="secondary"
          onPress={() => navigation.navigate('BalanceSummary', { accountId })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  detail: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.textMuted },
  value: { ...typography.label, color: colors.text },
});
