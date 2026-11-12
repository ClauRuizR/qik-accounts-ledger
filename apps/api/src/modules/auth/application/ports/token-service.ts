import type { AuthenticatedUser } from '../../../../common/auth/authenticated-user.js';

export abstract class TokenService {
  abstract issue(user: AuthenticatedUser): Promise<string>;
  /** Returns the token's subject, or null when the token is invalid/expired. */
  abstract verify(token: string): Promise<AuthenticatedUser | null>;
}
