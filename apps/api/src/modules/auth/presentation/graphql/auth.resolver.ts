import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../../../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../../../common/auth/current-user.decorator.js';
import { Public } from '../../../../common/auth/public.decorator.js';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case.js';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case.js';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import {
  AuthPayloadType,
  LoginInput,
  RegisterInput,
  UserType,
} from './auth.types.js';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Public()
  @Mutation(() => AuthPayloadType)
  register(@Args('input') input: RegisterInput): Promise<AuthPayloadType> {
    return this.registerUser.execute(input);
  }

  @Public()
  @Mutation(() => AuthPayloadType)
  login(@Args('input') input: LoginInput): Promise<AuthPayloadType> {
    return this.loginUser.execute(input);
  }

  @Query(() => UserType)
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserType> {
    return this.getCurrentUser.execute(user.id);
  }
}
