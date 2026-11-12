import { CombinedGraphQLErrors } from '@apollo/client';
import { getErrorCode, getErrorMessage } from '../errors';

const gqlError = (code: string, message = 'server message') =>
  new CombinedGraphQLErrors({ errors: [{ message, extensions: { code } }] });

describe('API error mapping', () => {
  it('maps known codes to friendly messages', () => {
    expect(getErrorMessage(gqlError('INSUFFICIENT_FUNDS'))).toBe(
      'Insufficient funds for this debit.',
    );
    expect(getErrorMessage(gqlError('INVALID_CREDENTIALS'))).toBe('Invalid email or password.');
    expect(getErrorCode(gqlError('ACCOUNT_NOT_FOUND'))).toBe('ACCOUNT_NOT_FOUND');
  });

  it("falls back to the API's user-facing message for other business errors", () => {
    expect(getErrorMessage(gqlError('INVALID_AMOUNT', 'Amount cannot exceed 1000000000.00'))).toBe(
      'Amount cannot exceed 1000000000.00',
    );
  });

  it('reports transport failures as a connectivity problem', () => {
    expect(getErrorMessage(new TypeError('Network request failed'))).toBe(
      'Cannot reach the server. Check your connection and try again.',
    );
    expect(getErrorCode(new Error('boom'))).toBeUndefined();
  });
});
