import { unwrapResolverError } from '@apollo/server/errors';
import {
  BadRequestException,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import { DomainError, ErrorCode } from '../errors/domain-error.js';

const logger = new Logger('GraphQLError');

/** Codes produced by graphql-js / Apollo that are safe to show the client. */
const PASSTHROUGH_CODES = new Set([
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'OPERATION_RESOLUTION_FAILURE',
  'BAD_REQUEST',
]);

function format(
  formatted: GraphQLFormattedError,
  code: string,
  message: string,
  details?: unknown,
): GraphQLFormattedError {
  return {
    message,
    locations: formatted.locations,
    path: formatted.path,
    extensions: details === undefined ? { code } : { code, details },
  };
}

function fromHttpException(
  formatted: GraphQLFormattedError,
  exception: HttpException,
): GraphQLFormattedError {
  if (exception instanceof UnauthorizedException) {
    return format(
      formatted,
      ErrorCode.UNAUTHENTICATED,
      'Authentication required',
    );
  }
  if (exception instanceof BadRequestException) {
    // ValidationPipe puts the per-field messages in response.message.
    const response = exception.getResponse();
    const details =
      typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : undefined;
    return format(
      formatted,
      ErrorCode.BAD_USER_INPUT,
      'Invalid input',
      details,
    );
  }
  if (exception.getStatus() < 500) {
    return format(formatted, ErrorCode.BAD_USER_INPUT, exception.message);
  }
  return format(formatted, ErrorCode.INTERNAL_ERROR, 'Internal server error');
}

/**
 * Maps every error leaving the GraphQL layer to a stable shape:
 * `{ message, path, locations, extensions: { code, details? } }`.
 *
 * Unknown errors (database failures, bugs) are logged server-side and returned
 * as a generic INTERNAL_ERROR, so SQL, stack traces and infrastructure details
 * never reach the client.
 */
export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const original = unwrapResolverError(error);

  if (original instanceof DomainError) {
    return format(formatted, original.code, original.message);
  }
  if (original instanceof HttpException) {
    return fromHttpException(formatted, original);
  }

  const code = formatted.extensions?.code;
  // Request-level errors (parse/validation, scalar coercion) carry a known
  // code and a message that describes the client's own input.
  if (typeof code === 'string' && PASSTHROUGH_CODES.has(code)) {
    return format(formatted, code, formatted.message);
  }
  if (original instanceof GraphQLError && code === ErrorCode.UNAUTHENTICATED) {
    return format(formatted, code, formatted.message);
  }

  logger.error(
    original instanceof Error
      ? (original.stack ?? original.message)
      : String(original),
  );
  return format(formatted, ErrorCode.INTERNAL_ERROR, 'Internal server error');
}
