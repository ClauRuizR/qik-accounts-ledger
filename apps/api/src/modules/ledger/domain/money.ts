import { Decimal } from 'decimal.js';
import { InvalidAmountError } from './ledger.errors.js';

/**
 * Isolated Decimal constructor: arbitrary precision, no global config
 * mutation. Monetary values never touch JavaScript `number`.
 */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** Matches the NUMERIC(20,2) columns. */
export const MONEY_SCALE = 2;
/** Largest value NUMERIC(20,2) can hold. */
const MAX_STORABLE = new D('999999999999999999.99');
/** Business limit for a single credit or debit. */
export const MAX_TRANSACTION_AMOUNT = '1000000000.00';

const PLAIN_DECIMAL = /^-?\d+(\.\d+)?$/;

/** Immutable monetary amount with exactly two fraction digits. */
export class Money {
  private constructor(private readonly value: Decimal) {}

  static zero(): Money {
    return new Money(new D(0));
  }

  /**
   * Parses a stored/trusted decimal string (e.g. a NUMERIC column).
   * Rejects anything with more than two fraction digits rather than rounding.
   */
  static of(input: string): Money {
    const trimmed = input.trim();
    if (!PLAIN_DECIMAL.test(trimmed)) {
      throw new InvalidAmountError('Amount is not a valid decimal number');
    }
    const value = new D(trimmed);
    if (value.decimalPlaces() > MONEY_SCALE) {
      throw new InvalidAmountError(
        `Amounts can have at most ${MONEY_SCALE} decimal places`,
      );
    }
    return new Money(value);
  }

  /** Parses a client-supplied transaction amount: strictly positive and within limits. */
  static transactionAmount(input: string): Money {
    const amount = Money.of(input);
    if (!amount.value.greaterThan(0)) {
      throw new InvalidAmountError('Amount must be greater than zero');
    }
    if (amount.value.greaterThan(MAX_TRANSACTION_AMOUNT)) {
      throw new InvalidAmountError(
        `Amount cannot exceed ${MAX_TRANSACTION_AMOUNT}`,
      );
    }
    return amount;
  }

  plus(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  minus(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  exceedsStorableRange(): boolean {
    return this.value.abs().greaterThan(MAX_STORABLE);
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  /** Canonical representation, always two fraction digits: "100.00". */
  toString(): string {
    return this.value.toFixed(MONEY_SCALE);
  }
}
