import { DomainError, ErrorCode } from '../../../common/errors/domain-error.js';

export class EmailAlreadyRegisteredError extends DomainError {
  constructor() {
    super(
      ErrorCode.EMAIL_ALREADY_REGISTERED,
      'This email is already registered',
    );
  }
}
