import { Scalar, type CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, type ValueNode } from 'graphql';

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

function parseDecimal(value: unknown): string {
  // Only strings are accepted: a JSON number has already been through
  // IEEE-754 floating point on the client and may have lost precision.
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value.trim())) {
    throw new GraphQLError(
      'Decimal must be a string in plain decimal notation, e.g. "100.50"',
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  return value.trim();
}

/**
 * Arbitrary-precision decimal transported as a string ("1234.50").
 * Range/scale rules (e.g. positive, max 2 decimals) are business rules and
 * live in the domain `Money` value object, not here.
 */
@Scalar('Decimal')
export class DecimalScalar implements CustomScalar<string, string> {
  description =
    'Decimal number serialized as a string to avoid floating-point errors, e.g. "100.50"';

  parseValue(value: unknown): string {
    return parseDecimal(value);
  }

  serialize(value: unknown): string {
    if (typeof value === 'string') return value;
    // Values reach the API layer as strings (pg NUMERIC → string, Money → string).
    throw new GraphQLError('Decimal values must be serialized from strings');
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) return parseDecimal(ast.value);
    return parseDecimal(undefined);
  }
}
