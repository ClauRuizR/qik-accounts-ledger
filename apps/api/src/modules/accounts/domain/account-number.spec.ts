import { randomInt } from 'node:crypto';
import {
  generateAccountNumber,
  isValidAccountNumber,
  luhnCheckDigit,
} from './account-number.js';

describe('account numbers', () => {
  it('generates 12-digit numbers with a valid Luhn check digit', () => {
    for (let i = 0; i < 1_000; i++) {
      const number = generateAccountNumber(randomInt);
      expect(number).toMatch(/^[1-9]\d{11}$/);
      expect(isValidAccountNumber(number)).toBe(true);
    }
  });

  it('computes the standard Luhn check digit', () => {
    // Canonical Luhn test vector: 7992739871 → check digit 3.
    expect(luhnCheckDigit('7992739871')).toBe(3);
  });

  it('builds the number from the random source plus the check digit', () => {
    const digits = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let i = 0;
    // Payload 10000000000: the leading 1 is in a doubled position → sum 2 → check 8.
    expect(generateAccountNumber(() => digits[i++])).toBe('100000000008');
  });

  it('detects single-digit typos', () => {
    const number = generateAccountNumber(randomInt);
    const last = Number(number.at(-1));
    const typo = number.slice(0, -1) + String((last + 1) % 10);
    expect(isValidAccountNumber(typo)).toBe(false);
  });

  it.each(['', '12345', '012345678901', '1234567890123', 'abcdefghijkl'])(
    'rejects malformed value %j',
    (value) => expect(isValidAccountNumber(value)).toBe(false),
  );
});
