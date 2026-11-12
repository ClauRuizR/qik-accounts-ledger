import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DecimalScalar } from '../../../../common/graphql/decimal.scalar.js';
import { CurrencyEnum } from '../../../accounts/presentation/graphql/account.types.js';
import type { Currency } from '../../../accounts/domain/currency.js';
import {
  TRANSACTION_TYPES,
  type TransactionType,
} from '../../domain/ledger-entry.js';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type SortOrder,
} from '../../domain/transaction-query.js';
import { TransactionGqlType, TransactionTypeEnum } from './ledger.types.js';

export const SortOrderEnum = { ASC: 'ASC', DESC: 'DESC' } as const;
registerEnumType(SortOrderEnum, {
  name: 'SortOrder',
  description: 'Ordering by creation date (ties broken by posting sequence).',
});

@InputType()
export class TransactionFilterInput {
  @Field(() => TransactionTypeEnum, { nullable: true })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @Field({ nullable: true, description: 'Inclusive lower bound on createdAt.' })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true, description: 'Inclusive upper bound on createdAt.' })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `Page size, 1–${MAX_PAGE_SIZE}.`,
  })
  @IsOptional()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  first?: number;

  @Field({ nullable: true, description: 'endCursor from the previous page.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  after?: string;

  @Field(() => SortOrderEnum, { nullable: true, defaultValue: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: SortOrder;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType()
export class TransactionConnection {
  @Field(() => [TransactionGqlType])
  items: TransactionGqlType[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int, {
    description: 'Total matching the filters (ignores pagination).',
  })
  totalCount: number;
}

@ObjectType()
export class BalancePoint {
  @Field()
  at: Date;

  @Field(() => DecimalScalar)
  balance: string;
}

@ObjectType()
export class BalanceSummary {
  @Field(() => ID)
  accountId: string;

  @Field(() => CurrencyEnum)
  currency: Currency;

  @Field(() => DecimalScalar)
  currentBalance: string;

  @Field(() => DecimalScalar)
  totalCredits: string;

  @Field(() => DecimalScalar)
  totalDebits: string;

  @Field(() => Int)
  transactionCount: number;

  /** Up to MAX_HISTORY_POINTS; trimmed by the `history` field resolver. */
  allHistory: BalancePoint[];
}
