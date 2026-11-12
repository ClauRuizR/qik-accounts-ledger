import { Money } from './money.js';

describe('Money', () => {
  it('avoids floating-point errors', () => {
    expect(Money.of('0.1').plus(Money.of('0.2')).toString()).toBe('0.30');
    expect(Money.of('100.00').minus(Money.of('99.99')).toString()).toBe('0.01');
  });

  it('formats canonically with two decimals', () => {
    expect(Money.of('100').toString()).toBe('100.00');
    expect(Money.of('7.5').toString()).toBe('7.50');
    expect(Money.zero().toString()).toBe('0.00');
  });

  it('handles values beyond Number.MAX_SAFE_INTEGER exactly', () => {
    const big = Money.of('90071992547409930.01');
    expect(big.plus(Money.of('0.01')).toString()).toBe('90071992547409930.02');
  });

  it.each(['1.001', '0.005', '10.123'])(
    'rejects more than two decimals: %s',
    (v) => {
      expect(() => Money.of(v)).toThrow(
        expect.objectContaining({ code: 'INVALID_AMOUNT' }) as Error,
      );
    },
  );

  it.each(['abc', '', '1e5', 'NaN', 'Infinity', '1,000.00', '--1'])(
    'rejects non-decimal input %j',
    (v) => {
      expect(() => Money.of(v)).toThrow(
        expect.objectContaining({ code: 'INVALID_AMOUNT' }) as Error,
      );
    },
  );

  describe('transactionAmount', () => {
    it('accepts positive amounts within the limit', () => {
      expect(Money.transactionAmount('0.01').toString()).toBe('0.01');
      expect(Money.transactionAmount('1000000000.00').toString()).toBe(
        '1000000000.00',
      );
    });

    it.each([
      ['0', 'greater than zero'],
      ['0.00', 'greater than zero'],
      ['-5.00', 'greater than zero'],
      ['1000000000.01', 'cannot exceed'],
    ])('rejects %s', (v, message) => {
      expect(() => Money.transactionAmount(v)).toThrow(message);
    });
  });

  it('compares by value regardless of formatting', () => {
    expect(Money.of('10').equals(Money.of('10.00'))).toBe(true);
    expect(Money.of('9.99').lessThan(Money.of('10'))).toBe(true);
    expect(Money.of('-0.00').isNegative()).toBe(false);
    expect(Money.of('-0.01').isNegative()).toBe(true);
  });
});
