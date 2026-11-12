import { DomainError, ErrorCode } from '../../../common/errors/domain-error.js';

/** Deliberately vague: does not reveal whether the email exists. */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
  }
}

export class UnauthenticatedError extends DomainError {
  constructor() {
    super(ErrorCode.UNAUTHENTICATED, 'Authentication required');
  }
}
