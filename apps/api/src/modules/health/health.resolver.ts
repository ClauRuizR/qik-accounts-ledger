import { Public } from '../../common/auth/public.decorator.js';
import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Public()
  @Query(() => String, {
    description: 'Liveness probe for the GraphQL endpoint.',
  })
  health(): string {
    return 'ok';
  }
}
