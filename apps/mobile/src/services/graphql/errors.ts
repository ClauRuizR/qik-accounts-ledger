import { CombinedGraphQLErrors } from '@apollo/client';

/** Error codes returned by the API in `extensions.code`. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_CURSOR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'BAD_USER_INPUT'
  | 'INTERNAL_ERROR';

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
  ACCOUNT_NOT_FOUND: 'Account not found.',
  ACCOUNT_INACTIVE: 'This account is inactive.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this debit.',
  INVALID_DATE_RANGE: 'The start date must be before the end date.',
  IDEMPOTENCY_CONFLICT:
    'This request conflicts with one already submitted. Please review and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

export function getErrorCode(error: unknown): ApiErrorCode | undefined {
  if (CombinedGraphQLErrors.is(error)) {
    const code = error.errors[0]?.extensions?.code;
    return typeof code === 'string' ? (code as ApiErrorCode) : undefined;
  }
  return undefined;
}

/** User-facing message for any Apollo error. */
export function getErrorMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    const code = getErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    // Business-rule messages from the API (e.g. INVALID_AMOUNT) are written for users.
    return known ?? error.errors[0]?.message ?? 'Request failed.';
  }
  return 'Cannot reach the server. Check your connection and try again.';
}
