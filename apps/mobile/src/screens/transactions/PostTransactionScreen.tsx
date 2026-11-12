import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { MoneyText } from '../../components/common/MoneyText';
import { Screen } from '../../components/common/Screen';
import { ErrorBanner, ErrorState, LoadingState } from '../../components/common/States';
import { TextField } from '../../components/common/TextField';
import { useAccount } from '../../hooks/useAccounts';
import { usePostTransaction } from '../../hooks/usePostTransaction';
import type { AppScreenProps } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { toCents, validateAmount } from '../../utils/money';

const MAX_DESCRIPTION = 255;

export function PostTransactionScreen({ navigation, route }: AppScreenProps<'PostTransaction'>) {
  const { accountId, type } = route.params;
  const isCredit = type === 'CREDIT';
  const { account, loading: accountLoading, error: accountError, refresh } = useAccount(accountId);
  const { post, loading, error } = usePostTransaction(type);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; description?: string }>({});

  if (accountLoading) return <LoadingState />;
  if (!account) {
    return <ErrorState message={accountError ?? 'Account not found.'} onRetry={refresh} />;
  }

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    const amountError = validateAmount(amount);
    if (amountError) next.amount = amountError;
    // Friendly early check only — the server re-validates under a row lock.
    else if (!isCredit && toCents(amount.trim()) > toCents(account.balance)) {
      next.amount = 'Amount exceeds the available balance';
    }
    if (description.trim().length > MAX_DESCRIPTION) {
      next.description = `Description must be at most ${MAX_DESCRIPTION} characters`;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (loading || !validate()) return;
    const transaction = await post(accountId, amount, description);
    // On failure the draft stays in the form so the user can retry.
    if (transaction) navigation.goBack();
  };

  return (
    <Screen scroll>
      <Card>
        <Text style={styles.label}>Available balance</Text>
        <MoneyText amount={account.balance} currency={account.currency} size="large" />
      </Card>
      {error ? <ErrorBanner message={error} /> : null}
      <TextField
        label={`Amount (${account.currency})`}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        error={fieldErrors.amount}
        keyboardType="decimal-pad"
        testID="amount-input"
      />
      <TextField
        label="Description (optional)"
        placeholder={isCredit ? 'e.g. Salary' : 'e.g. Rent'}
        value={description}
        onChangeText={setDescription}
        error={fieldErrors.description}
        maxLength={MAX_DESCRIPTION}
        testID="description-input"
      />
      <Button
        title={isCredit ? 'Credit account' : 'Debit account'}
        onPress={onSubmit}
        loading={loading}
        testID="post-transaction-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textMuted },
});
