import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../../users/domain/user.js';
import { EmailAlreadyRegisteredError } from '../../../users/domain/user.errors.js';
import { UserRepository } from '../../../users/domain/user.repository.js';
import { type AuthResult, toPublicUser } from '../auth-result.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { TokenService } from '../ports/token-service.js';

export interface RegisterUserCommand {
  email: string;
  password: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<AuthResult> {
    const email = normalizeEmail(command.email);
    // Fast path for a friendly error; the unique index is the real guarantee.
    if (await this.users.findByEmail(email))
      throw new EmailAlreadyRegisteredError();

    const passwordHash = await this.hasher.hash(command.password);
    const user = await this.users.create({ email, passwordHash });
    const accessToken = await this.tokens.issue({
      id: user.id,
      email: user.email,
    });
    return { accessToken, user: toPublicUser(user) };
  }
}
