import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../users/domain/user.repository.js';
import { UnauthenticatedError } from '../auth.errors.js';
import { type PublicUser, toPublicUser } from '../auth-result.js';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    // A valid token for a user that no longer exists is treated as unauthenticated.
    if (!user) throw new UnauthenticatedError();
    return toPublicUser(user);
  }
}
