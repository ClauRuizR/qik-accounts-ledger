import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.container} accessibilityRole="radiogroup" testID={testID}>
        {segments.map((segment) => {
          const selected = segment.value === value;
          return (
            <Pressable
              key={segment.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={segment.label}
              onPress={() => onChange(segment.value)}
              style={[styles.segment, selected && styles.selected]}
            >
              <Text style={[styles.text, selected && styles.selectedText]}>{segment.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  selected: { backgroundColor: colors.surface },
  text: { ...typography.label, color: colors.textMuted },
  selectedText: { color: colors.text },
});
