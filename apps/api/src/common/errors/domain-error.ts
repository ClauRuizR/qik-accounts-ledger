/**
 * Stable, client-facing error codes. Exposed in GraphQL `extensions.code`.
 * Framework-agnostic: domain and application layers throw these without
 * knowing about GraphQL or HTTP.
 */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_CURSOR: 'INVALID_CURSOR',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Base class for every expected business-rule violation. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
