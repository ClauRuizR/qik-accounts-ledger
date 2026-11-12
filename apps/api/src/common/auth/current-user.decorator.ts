import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from './authenticated-user.js';
import { getRequest } from './request-context.js';

/** Injects the authenticated user populated by the global JWT guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context): AuthenticatedUser => {
    const user = getRequest(context).user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
