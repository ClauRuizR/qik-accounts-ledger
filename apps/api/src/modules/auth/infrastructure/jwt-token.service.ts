import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.js';
import { TokenService } from '../application/ports/token-service.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtTokenService extends TokenService {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(user: AuthenticatedUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload =
        await this.jwt.verifyAsync<Partial<AccessTokenPayload>>(token);
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        return null;
      }
      return { id: payload.sub, email: payload.email };
    } catch {
      return null; // expired, bad signature, malformed
    }
  }
}
