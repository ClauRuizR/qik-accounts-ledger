import { StyleSheet, Text, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme';
import type { Currency, TransactionType } from '../../types/models';
import { formatMoney } from '../../utils/money';

interface MoneyTextProps {
  amount: string;
  currency: Currency;
  /** Colors and signs the amount as a credit (+) or debit (−). */
  type?: TransactionType;
  size?: 'body' | 'large';
  testID?: string;
}

export function MoneyText({ amount, currency, type, size = 'body', testID }: MoneyTextProps) {
  const sign = type === 'CREDIT' ? '+' : type === 'DEBIT' ? '−' : '';
  const color: TextStyle = {
    color: type === 'CREDIT' ? colors.credit : type === 'DEBIT' ? colors.debit : colors.text,
  };
  return (
    <Text style={[size === 'large' ? styles.large : styles.body, color]} testID={testID}>
      {sign}
      {formatMoney(amount, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  large: { ...typography.amountLarge },
});
