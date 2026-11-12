import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { DomainError, ErrorCode } from '../errors/domain-error.js';
import { formatGraphQLError } from './format-graphql-error.js';

const base = { message: 'raw', path: ['field'] };

describe('formatGraphQLError', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('exposes domain errors with their code', () => {
    const result = formatGraphQLError(
      base,
      new DomainError(ErrorCode.INSUFFICIENT_FUNDS, 'Insufficient funds'),
    );
    expect(result).toEqual({
      message: 'Insufficient funds',
      path: ['field'],
      locations: undefined,
      extensions: { code: 'INSUFFICIENT_FUNDS' },
    });
  });

  it('maps auth guard failures to UNAUTHENTICATED', () => {
    const result = formatGraphQLError(base, new UnauthorizedException());
    expect(result.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  it('maps validation failures to BAD_USER_INPUT with field details', () => {
    const result = formatGraphQLError(
      base,
      new BadRequestException(['email must be an email']),
    );
    expect(result.extensions).toEqual({
      code: 'BAD_USER_INPUT',
      details: ['email must be an email'],
    });
  });

  it('passes through GraphQL validation errors', () => {
    const result = formatGraphQLError(
      {
        message: 'Cannot query field "x"',
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      },
      new GraphQLError('Cannot query field "x"'),
    );
    expect(result.extensions).toEqual({ code: 'GRAPHQL_VALIDATION_FAILED' });
  });

  it('hides unexpected errors such as database failures', () => {
    const dbError = new Error(
      'duplicate key value violates unique constraint "users_pkey"',
    );
    const result = formatGraphQLError(
      { ...base, extensions: { code: 'INTERNAL_SERVER_ERROR' } },
      dbError,
    );
    expect(result.message).toBe('Internal server error');
    expect(result.extensions).toEqual({ code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(result)).not.toContain('users_pkey');
  });
});
