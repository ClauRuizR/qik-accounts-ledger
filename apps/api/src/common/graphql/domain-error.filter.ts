import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { DomainError } from '../errors/domain-error.js';

/**
 * Expected business-rule violations are part of normal operation, so they
 * bypass Nest's default handler (which logs them at ERROR level). They are
 * returned to GraphQL as-is and shaped by `formatGraphQLError`.
 */
@Catch(DomainError)
export class DomainErrorFilter implements GqlExceptionFilter {
  catch(error: DomainError): DomainError {
    return error;
  }
}
