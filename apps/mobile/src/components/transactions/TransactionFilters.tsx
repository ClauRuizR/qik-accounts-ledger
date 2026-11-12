import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import type { SortOrder, TransactionFilters as Filters, TransactionType } from '../../types/models';
import { endOfDayIso, parseDateInput, startOfDayIso } from '../../utils/date';
import { Button } from '../common/Button';
import { SegmentedControl } from '../common/SegmentedControl';
import { TextField } from '../common/TextField';

type TypeOption = 'ALL' | TransactionType;

const TYPE_SEGMENTS = [
  { value: 'ALL', label: 'All' },
  { value: 'CREDIT', label: 'Credits' },
  { value: 'DEBIT', label: 'Debits' },
] as const;

const SORT_SEGMENTS = [
  { value: 'DESC', label: 'Newest first' },
  { value: 'ASC', label: 'Oldest first' },
] as const;

interface TransactionFiltersProps {
  onApply: (filters: Filters) => void;
}

/**
 * Filter form. Dates are typed as YYYY-MM-DD (local calendar days) and sent
 * as inclusive day bounds: start of the start day … end of the end day.
 */
export function TransactionFilters({ onApply }: TransactionFiltersProps) {
  const [type, setType] = useState<TypeOption>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({});

  const apply = () => {
    const start = startInput.trim() ? parseDateInput(startInput) : undefined;
    const end = endInput.trim() ? parseDateInput(endInput) : undefined;
    const next: typeof errors = {};
    if (start === null) next.start = 'Use the format YYYY-MM-DD';
    if (end === null) next.end = 'Use the format YYYY-MM-DD';
    if (start && end && start.getTime() > end.getTime()) {
      next.end = 'End date must be on or after the start date';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onApply({
      ...(type !== 'ALL' ? { type } : {}),
      ...(start ? { startDate: startOfDayIso(start) } : {}),
      ...(end ? { endDate: endOfDayIso(end) } : {}),
      sortOrder,
    });
  };

  const clear = () => {
    setType('ALL');
    setSortOrder('DESC');
    setStartInput('');
    setEndInput('');
    setErrors({});
    onApply({ sortOrder: 'DESC' });
  };

  return (
    <View style={styles.container} testID="transaction-filters">
      <SegmentedControl label="Type" segments={TYPE_SEGMENTS} value={type} onChange={setType} />
      <View style={styles.dates}>
        <View style={styles.date}>
          <TextField
            label="From"
            placeholder="YYYY-MM-DD"
            value={startInput}
            onChangeText={setStartInput}
            error={errors.start}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            testID="filter-start-date"
          />
        </View>
        <View style={styles.date}>
          <TextField
            label="To"
            placeholder="YYYY-MM-DD"
            value={endInput}
            onChangeText={setEndInput}
            error={errors.end}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            testID="filter-end-date"
          />
        </View>
      </View>
      <SegmentedControl
        label="Order"
        segments={SORT_SEGMENTS}
        value={sortOrder}
        onChange={setSortOrder}
      />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Clear" variant="secondary" onPress={clear} />
        </View>
        <View style={styles.action}>
          <Button title="Apply filters" onPress={apply} testID="apply-filters" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  dates: { flexDirection: 'row', gap: spacing.md },
  date: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
