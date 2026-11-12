import { DomainError, ErrorCode } from '../../../common/errors/domain-error.js';

export class InvalidAmountError extends DomainError {
  constructor(message: string) {
    super(ErrorCode.INVALID_AMOUNT, message);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super(ErrorCode.INSUFFICIENT_FUNDS, 'Insufficient funds for this debit');
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor() {
    super(
      ErrorCode.IDEMPOTENCY_CONFLICT,
      'This idempotency key was already used for a different transaction',
    );
  }
}
