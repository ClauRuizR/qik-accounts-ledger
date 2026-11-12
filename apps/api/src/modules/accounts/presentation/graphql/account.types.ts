import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsIn, IsOptional } from 'class-validator';
import { DecimalScalar } from '../../../../common/graphql/decimal.scalar.js';
import { ACCOUNT_STATUSES, type AccountStatus } from '../../domain/account.js';
import { CURRENCIES, type Currency } from '../../domain/currency.js';

const toEnum = <T extends string>(values: readonly T[]) =>
  Object.fromEntries(values.map((v) => [v, v])) as Record<T, T>;

export const CurrencyEnum = toEnum(CURRENCIES);
export const AccountStatusEnum = toEnum(ACCOUNT_STATUSES);
registerEnumType(CurrencyEnum, { name: 'Currency' });
registerEnumType(AccountStatusEnum, { name: 'AccountStatus' });

@ObjectType('Account')
export class AccountType {
  @Field(() => ID)
  id: string;

  @Field({ description: '12-digit account number with a Luhn check digit.' })
  accountNumber: string;

  @Field(() => CurrencyEnum)
  currency: Currency;

  @Field(() => DecimalScalar)
  balance: string;

  @Field(() => AccountStatusEnum)
  status: AccountStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType('AccountBalance')
export class AccountBalanceType {
  @Field(() => ID)
  accountId: string;

  @Field(() => DecimalScalar)
  balance: string;

  @Field(() => CurrencyEnum)
  currency: Currency;

  @Field({ description: 'Timestamp of the last change to this balance.' })
  asOf: Date;
}

@InputType()
export class CreateAccountInput {
  @Field(() => CurrencyEnum, { nullable: true, defaultValue: 'DOP' })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;
}
