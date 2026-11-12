import type { User } from './user.js';

export interface NewUser {
  email: string;
  passwordHash: string;
}

/** Persistence port for users. Implemented in the infrastructure layer. */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  /** `email` must already be normalized. */
  abstract findByEmail(email: string): Promise<User | null>;
  /** @throws EmailAlreadyRegisteredError when the email is taken. */
  abstract create(user: NewUser): Promise<User>;
}
