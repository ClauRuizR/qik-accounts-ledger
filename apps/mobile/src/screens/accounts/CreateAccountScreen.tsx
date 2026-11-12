import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { ErrorBanner } from '../../components/common/States';
import { useCreateAccount } from '../../hooks/useAccounts';
import type { AppScreenProps } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { CURRENCIES, type Currency } from '../../types/models';

const SEGMENTS = CURRENCIES.map((c) => ({ value: c, label: c }));

export function CreateAccountScreen({ navigation }: AppScreenProps<'CreateAccount'>) {
  const [currency, setCurrency] = useState<Currency>('DOP');
  const { create, loading, error } = useCreateAccount();

  const onCreate = async () => {
    const account = await create(currency);
    if (account) navigation.replace('AccountDetails', { accountId: account.id });
  };

  return (
    <Screen scroll>
      <Text style={styles.intro}>
        Choose the account currency. New accounts start with a zero balance.
      </Text>
      <SegmentedControl
        label="Currency"
        segments={SEGMENTS}
        value={currency}
        onChange={setCurrency}
        testID="currency-picker"
      />
      {error ? <ErrorBanner message={error} /> : null}
      <Button
        title="Create account"
        onPress={onCreate}
        loading={loading}
        testID="create-account-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.textMuted },
});
