import { Kind } from 'graphql';
import { DecimalScalar } from './decimal.scalar.js';

describe('DecimalScalar', () => {
  const scalar = new DecimalScalar();

  it.each(['0', '100', '100.50', '-3.25', ' 7.10 '])('accepts %j', (input) => {
    expect(scalar.parseValue(input)).toBe(input.trim());
  });

  it.each([100.5, '1e3', 'abc', '', '1.', '.5', null, undefined])(
    'rejects %j (numbers are refused to avoid float precision loss)',
    (input) => {
      expect(() => scalar.parseValue(input)).toThrow(
        /Decimal must be a string/,
      );
    },
  );

  it('parses string literals and rejects numeric literals', () => {
    expect(scalar.parseLiteral({ kind: Kind.STRING, value: '12.34' })).toBe(
      '12.34',
    );
    expect(() =>
      scalar.parseLiteral({ kind: Kind.FLOAT, value: '12.34' }),
    ).toThrow();
  });

  it('serializes strings as-is', () => {
    expect(scalar.serialize('100.00')).toBe('100.00');
    expect(() => scalar.serialize(100)).toThrow();
  });
});
