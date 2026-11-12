import { DomainError, ErrorCode } from '../../../common/errors/domain-error.js';

/**
 * Also used when the account exists but belongs to another user, so callers
 * cannot probe for other users' account ids.
 */
export class AccountNotFoundError extends DomainError {
  constructor() {
    super(ErrorCode.ACCOUNT_NOT_FOUND, 'Account not found');
  }
}

export class AccountInactiveError extends DomainError {
  constructor() {
    super(ErrorCode.ACCOUNT_INACTIVE, 'Account is not active');
  }
}

/** Internal signal (not client-facing): a generated account number collided. */
export class AccountNumberTakenError extends Error {
  constructor() {
    super('Account number already in use');
    this.name = 'AccountNumberTakenError';
  }
}
