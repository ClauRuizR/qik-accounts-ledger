import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../../users/domain/user.js';
import { UserRepository } from '../../../users/domain/user.repository.js';
import { InvalidCredentialsError } from '../auth.errors.js';
import { type AuthResult, toPublicUser } from '../auth-result.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { TokenService } from '../ports/token-service.js';

export interface LoginUserCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthResult> {
    const user = await this.users.findByEmail(normalizeEmail(command.email));

    // Always run one hash verification so response time does not reveal
    // whether the email is registered.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(hash, command.password);
    if (!user || !valid) throw new InvalidCredentialsError();

    const accessToken = await this.tokens.issue({
      id: user.id,
      email: user.email,
    });
    return { accessToken, user: toPublicUser(user) };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('timing-equalization-dummy-password');
    return this.dummyHash;
  }
}
