import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { ErrorBanner } from '../../components/common/States';
import { TextField } from '../../components/common/TextField';
import { useAuthenticate } from '../../hooks/useAuthenticate';
import { colors, spacing, typography } from '../../theme';
import { validateEmail, validatePassword } from '../../utils/validation';

interface AuthFormProps {
  mode: 'login' | 'register';
  switchLabel: string;
  onSwitch: () => void;
}

/** Shared by the Login and Register screens. */
export function AuthForm({ mode, switchLabel, onSwitch }: AuthFormProps) {
  const isSignUp = mode === 'register';
  const { submit, loading, error } = useAuthenticate(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async () => {
    const next = {
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password, { forSignUp: isSignUp }) ?? undefined,
    };
    setFieldErrors(next);
    if (next.email || next.password) return;
    await submit(email, password);
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.brand}>Qik</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create your Qik account' : 'Sign in to your accounts'}
        </Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="email-input"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        textContentType={isSignUp ? 'newPassword' : 'password'}
        placeholder={isSignUp ? 'At least 8 characters' : undefined}
        testID="password-input"
      />
      <Button
        title={isSignUp ? 'Create account' : 'Sign in'}
        onPress={onSubmit}
        loading={loading}
        testID="auth-submit"
      />
      <Button title={switchLabel} variant="secondary" onPress={onSwitch} disabled={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.xl },
  brand: { ...typography.title, fontSize: 40, color: colors.primary },
  subtitle: { ...typography.body, color: colors.textMuted },
});
