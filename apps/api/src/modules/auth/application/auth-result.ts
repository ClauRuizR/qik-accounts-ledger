import type { User } from '../../users/domain/user.js';

export type PublicUser = Pick<User, 'id' | 'email' | 'createdAt'>;

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export const toPublicUser = ({ id, email, createdAt }: User): PublicUser => ({
  id,
  email,
  createdAt,
});
