import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
}

export function TextField({ label, error, testID, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.disabled}
        style={[styles.input, error ? styles.inputError : null]}
        testID={testID}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  input: {
    ...typography.body,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
});
