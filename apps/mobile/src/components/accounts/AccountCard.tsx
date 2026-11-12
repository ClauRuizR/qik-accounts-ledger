import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import type { Account } from '../../types/models';
import { formatAccountNumber } from '../../utils/money';
import { MoneyText } from '../common/MoneyText';

interface AccountCardProps {
  account: Account;
  onPress: () => void;
}

export function AccountCard({ account, onPress }: AccountCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Account ${account.accountNumber}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`account-card-${account.id}`}
    >
      <View style={styles.row}>
        <Text style={styles.currency}>{account.currency}</Text>
        {account.status === 'INACTIVE' ? <Text style={styles.inactive}>Inactive</Text> : null}
      </View>
      <MoneyText amount={account.balance} currency={account.currency} size="large" />
      <Text style={styles.number}>{formatAccountNumber(account.accountNumber)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  currency: { ...typography.label, color: colors.textMuted },
  inactive: { ...typography.caption, color: colors.danger },
  number: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
