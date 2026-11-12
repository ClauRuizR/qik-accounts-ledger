import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, {
    description: 'Liveness probe for the GraphQL endpoint.',
  })
  health(): string {
    return 'ok';
  }
}
