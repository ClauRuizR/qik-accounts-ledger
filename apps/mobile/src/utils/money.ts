import type { Currency } from '../types/models';

/** Must match the API's per-transaction limit. */
export const MAX_TRANSACTION_AMOUNT = '1000000000.00';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Exact conversion of a validated decimal string to integer cents (no floats). */
export function toCents(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/**
 * Validates user input for a transaction amount.
 * @returns an error message, or null when valid.
 */
export function validateAmount(input: string): string | null {
  const value = input.trim();
  if (value === '') return 'Enter an amount';
  if (!AMOUNT_PATTERN.test(value)) return 'Use a number with up to 2 decimals, e.g. 150.25';
  const cents = toCents(value);
  if (cents <= 0n) return 'Amount must be greater than zero';
  if (cents > toCents(MAX_TRANSACTION_AMOUNT)) return 'Amount cannot exceed 1,000,000,000.00';
  return null;
}

/** Normalizes a valid amount to the canonical API form: "150" → "150.00". */
export function normalizeAmount(input: string): string {
  const cents = toCents(input.trim());
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

const CURRENCY_SYMBOL: Record<Currency, string> = { DOP: 'RD$', USD: 'US$', EUR: '€' };

/** "1234567.5" + DOP → "RD$ 1,234,567.50" — string-based, no floating point. */
export function formatMoney(amount: string, currency: Currency): string {
  const negative = amount.startsWith('-');
  const [whole, fraction = ''] = (negative ? amount.slice(1) : amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = fraction.padEnd(2, '0').slice(0, 2);
  return `${negative ? '-' : ''}${CURRENCY_SYMBOL[currency]} ${grouped}.${cents}`;
}

/** "100000000009" → "1000 0000 0009" for readability. */
export function formatAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
}
