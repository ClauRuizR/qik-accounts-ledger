import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { DecimalScalar } from './decimal.scalar.js';
import { formatGraphQLError } from './format-graphql-error.js';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // Code-first: schema generated in memory from decorators; the SDL is
        // also written to disk in development for review and client tooling.
        autoSchemaFile:
          config.NODE_ENV === 'development' ? 'schema.graphql' : true,
        sortSchema: true,
        path: '/graphql',
        graphiql: config.NODE_ENV !== 'production',
        introspection: config.NODE_ENV !== 'production',
        includeStacktraceInErrorResponses: false,
        formatError: formatGraphQLError,
        context: ({ req }: { req: unknown }) => ({ req }),
      }),
    }),
  ],
  providers: [DecimalScalar],
})
export class AppGraphQLModule {}
