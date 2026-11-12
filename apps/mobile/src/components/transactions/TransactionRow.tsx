import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { Currency, Transaction } from '../../types/models';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { MoneyText } from '../common/MoneyText';

interface TransactionRowProps {
  transaction: Transaction;
  currency: Currency;
}

export function TransactionRow({ transaction, currency }: TransactionRowProps) {
  const label = transaction.description || (transaction.type === 'CREDIT' ? 'Credit' : 'Debit');
  return (
    <View style={styles.row} testID={`transaction-${transaction.id}`}>
      <View style={styles.left}>
        <Text style={styles.description} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.meta}>{formatDateTime(transaction.createdAt)}</Text>
      </View>
      <View style={styles.right}>
        <MoneyText amount={transaction.amount} currency={currency} type={transaction.type} />
        <Text style={styles.meta}>Balance {formatMoney(transaction.balanceAfter, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  description: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
});
