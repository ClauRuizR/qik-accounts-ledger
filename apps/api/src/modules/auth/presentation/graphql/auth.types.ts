import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  createdAt: Date;
}

@ObjectType('AuthPayload')
export class AuthPayloadType {
  @Field({ description: 'JWT to send as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @Field(() => UserType)
  user: UserType;
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

@InputType()
export class RegisterInput {
  @Field()
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @Field({ description: '8–128 characters.' })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  // Upper bound protects the password hasher from oversized inputs.
  @MaxLength(128)
  password: string;
}

@InputType()
export class LoginInput {
  @Field()
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
