import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthenticatedUser } from './authenticated-user.js';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Returns the underlying HTTP request for both GraphQL and REST handlers. */
export function getRequest(context: ExecutionContext): AuthenticatedRequest {
  if (context.getType<string>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedRequest;
    }>().req;
  }
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}
