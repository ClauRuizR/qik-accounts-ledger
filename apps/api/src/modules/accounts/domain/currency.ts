export const CURRENCIES = ['DOP', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'DOP';
