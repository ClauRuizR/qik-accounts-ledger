/**
 * Account numbers are 12 digits: 11 random digits (first one non-zero) plus a
 * Luhn check digit, so typos are caught before any lookup.
 */
export const ACCOUNT_NUMBER_LENGTH = 12;

export function luhnCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    // Double every second digit counting from the right of the payload.
    let digit = Number(payload[payload.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** @param randomInt returns a uniformly random integer in [min, max). */
export function generateAccountNumber(
  randomInt: (min: number, max: number) => number,
): string {
  let payload = String(randomInt(1, 10));
  while (payload.length < ACCOUNT_NUMBER_LENGTH - 1)
    payload += String(randomInt(0, 10));
  return payload + String(luhnCheckDigit(payload));
}

export function isValidAccountNumber(value: string): boolean {
  if (!/^[1-9]\d{11}$/.test(value)) return false;
  return luhnCheckDigit(value.slice(0, -1)) === Number(value.at(-1));
}
