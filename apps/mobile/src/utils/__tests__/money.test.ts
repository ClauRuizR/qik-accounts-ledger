import {
  formatAccountNumber,
  formatMoney,
  normalizeAmount,
  toCents,
  validateAmount,
} from '../money';

describe('validateAmount', () => {
  it.each(['1', '0.01', '150.5', '150.25', ' 99.99 ', '1000000000.00'])('accepts %j', (v) => {
    expect(validateAmount(v)).toBeNull();
  });

  it.each([
    ['', 'Enter an amount'],
    ['   ', 'Enter an amount'],
    ['0', 'Amount must be greater than zero'],
    ['0.00', 'Amount must be greater than zero'],
    ['-5', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['1.001', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['1,000', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['1e3', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['abc', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['.5', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ['1000000000.01', 'Amount cannot exceed 1,000,000,000.00'],
  ])('rejects %j', (v, message) => {
    expect(validateAmount(v)).toBe(message);
  });
});

describe('toCents / normalizeAmount (exact, no floats)', () => {
  it('converts without floating-point error', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30n);
    expect(toCents('19.99')).toBe(1999n);
    expect(toCents('90071992547409.93')).toBe(9007199254740993n); // > MAX_SAFE_INTEGER
  });

  it.each([
    ['150', '150.00'],
    ['150.5', '150.50'],
    [' 007.05 ', '7.05'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeAmount(input)).toBe(expected);
  });
});

describe('formatMoney', () => {
  it.each([
    ['1234567.5', 'DOP', 'RD$ 1,234,567.50'],
    ['0.00', 'USD', 'US$ 0.00'],
    ['999', 'EUR', '€ 999.00'],
    ['-20.00', 'DOP', '-RD$ 20.00'],
  ] as const)('formats %s %s', (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });
});

it('groups account numbers for readability', () => {
  expect(formatAccountNumber('100000000008')).toBe('1000 0000 0008');
});
