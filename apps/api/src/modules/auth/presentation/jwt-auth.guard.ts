import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/auth/public.decorator.js';
import { getRequest } from '../../../common/auth/request-context.js';
import { TokenService } from '../application/ports/token-service.js';

/**
 * Global guard: every GraphQL operation and REST route requires a valid
 * `Authorization: Bearer <jwt>` header unless decorated with @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = getRequest(context);
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException();
    }

    const user = await this.tokens.verify(token);
    if (!user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
