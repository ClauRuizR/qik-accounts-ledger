import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/common/Card';
import { MoneyText } from '../../components/common/MoneyText';
import { ErrorBanner, ErrorState, LoadingState } from '../../components/common/States';
import { useBalanceSummary } from '../../hooks/useBalanceSummary';
import type { AppScreenProps } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import type { BalancePoint, Currency } from '../../types/models';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export function BalanceSummaryScreen({ route }: AppScreenProps<'BalanceSummary'>) {
  const { accountId } = route.params;
  const { summary, loading, error, refreshing, refresh } = useBalanceSummary(accountId);

  if (loading) return <LoadingState message="Loading summary…" />;
  if (!summary) {
    return <ErrorState message={error ?? 'Could not load the summary.'} onRetry={refresh} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? <ErrorBanner message={error} /> : null}
        <Card>
          <Text style={styles.label}>Current balance</Text>
          <MoneyText
            amount={summary.currentBalance}
            currency={summary.currency}
            size="large"
            testID="summary-balance"
          />
        </Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Card>
              <Text style={styles.label}>Total credits</Text>
              <MoneyText
                amount={summary.totalCredits}
                currency={summary.currency}
                type="CREDIT"
                testID="summary-credits"
              />
            </Card>
          </View>
          <View style={styles.flex}>
            <Card>
              <Text style={styles.label}>Total debits</Text>
              <MoneyText
                amount={summary.totalDebits}
                currency={summary.currency}
                type="DEBIT"
                testID="summary-debits"
              />
            </Card>
          </View>
        </View>
        <Text style={styles.caption} testID="summary-count">
          {summary.transactionCount}{' '}
          {summary.transactionCount === 1 ? 'transaction' : 'transactions'} in total
        </Text>

        <Card>
          <Text style={styles.heading}>Recent balance history</Text>
          {summary.history.length === 0 ? (
            <Text style={styles.caption}>No transactions yet.</Text>
          ) : (
            <BalanceHistory points={summary.history} currency={summary.currency} />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Newest first, with a bar proportional to the balance at each point. */
function BalanceHistory({ points, currency }: { points: BalancePoint[]; currency: Currency }) {
  // Number() is used only to size the bars (display); amounts shown are the exact strings.
  const max = Math.max(...points.map((p) => Number(p.balance)), 0);
  return (
    <View style={styles.history} testID="balance-history">
      {[...points].reverse().map((point, index) => {
        const ratio = max > 0 ? Number(point.balance) / max : 0;
        return (
          <View key={`${point.at}-${index}`} style={styles.point}>
            <Text style={styles.pointDate}>{formatDate(point.at)}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(ratio * 100, 2)}%` }]} />
            </View>
            <Text style={styles.pointAmount}>{formatMoney(point.balance, currency)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  label: { ...typography.label, color: colors.textMuted },
  heading: { ...typography.heading, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  history: { gap: spacing.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pointDate: { ...typography.caption, color: colors.textMuted, width: 84 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: { height: 8, backgroundColor: colors.primary, borderRadius: radius.sm },
  pointAmount: {
    ...typography.caption,
    color: colors.text,
    width: 110,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
