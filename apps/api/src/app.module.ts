import { Module } from '@nestjs/common';
import { AppGraphQLModule } from './common/graphql/graphql.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AppGraphQLModule,
    HealthModule,
    AuthModule,
    AccountsModule,
  ],
})
export class AppModule {}
