import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { UsersModule } from '../users/users.module.js';
import { PasswordHasher } from './application/ports/password-hasher.js';
import { TokenService } from './application/ports/token-service.js';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case.js';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case.js';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { JwtTokenService } from './infrastructure/jwt-token.service.js';
import { AuthResolver } from './presentation/graphql/auth.resolver.js';
import { JwtAuthGuard } from './presentation/jwt-auth.guard.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.JWT_EXPIRES_IN_SECONDS,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenService, useClass: JwtTokenService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    RegisterUserUseCase,
    LoginUserUseCase,
    GetCurrentUserUseCase,
    AuthResolver,
  ],
})
export class AuthModule {}
