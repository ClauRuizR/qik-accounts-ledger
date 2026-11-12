import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DecimalScalar } from '../../../../common/graphql/decimal.scalar.js';
import {
  TRANSACTION_TYPES,
  type TransactionType,
} from '../../domain/ledger-entry.js';

export const TransactionTypeEnum = Object.fromEntries(
  TRANSACTION_TYPES.map((t) => [t, t]),
) as Record<TransactionType, TransactionType>;
registerEnumType(TransactionTypeEnum, { name: 'TransactionType' });

@ObjectType('Transaction', { description: 'A posted, immutable ledger entry.' })
export class TransactionGqlType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  accountId: string;

  @Field(() => TransactionTypeEnum)
  type: TransactionType;

  @Field(() => DecimalScalar)
  amount: string;

  @Field()
  description: string;

  @Field(() => DecimalScalar, {
    description: 'Account balance right after this entry.',
  })
  balanceAfter: string;

  @Field()
  createdAt: Date;
}

@InputType()
export class PostTransactionInput {
  @Field(() => ID)
  @IsUUID('all', { message: 'accountId must be a UUID' })
  accountId: string;

  @Field(() => DecimalScalar, {
    description:
      'Positive amount with at most 2 decimals, as a string: "150.25".',
  })
  // Format is checked by the Decimal scalar; range/scale rules by the Money domain object.
  @IsString()
  amount: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(255)
  description?: string;

  @Field({
    nullable: true,
    description:
      'Client-generated key (e.g. a UUID). Retrying with the same key returns the original transaction instead of posting twice.',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9._:-]{1,64}$/, {
    message: 'idempotencyKey must be 1-64 characters: letters, digits, . _ : -',
  })
  idempotencyKey?: string;
}
