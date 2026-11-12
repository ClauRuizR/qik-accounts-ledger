import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.js';
import { Account } from '../modules/accounts/domain/account.js';
import { AccountNumberTakenError } from '../modules/accounts/domain/account.errors.js';
import {
  AccountRepository,
  type NewAccount,
} from '../modules/accounts/domain/account.repository.js';
import { PasswordHasher } from '../modules/auth/application/ports/password-hasher.js';
import { TokenService } from '../modules/auth/application/ports/token-service.js';
import type { User } from '../modules/users/domain/user.js';
import { EmailAlreadyRegisteredError } from '../modules/users/domain/user.errors.js';
import {
  type NewUser,
  UserRepository,
} from '../modules/users/domain/user.repository.js';

/** In-memory test doubles for the domain ports. Unit tests only. */

export class InMemoryUserRepository extends UserRepository {
  readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const found = [...this.users.values()].find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    return Promise.resolve(found ?? null);
  }

  async create(user: NewUser): Promise<User> {
    if (await this.findByEmail(user.email))
      throw new EmailAlreadyRegisteredError();
    const created: User = { ...user, id: randomUUID(), createdAt: new Date() };
    this.users.set(created.id, created);
    return created;
  }
}

export class InMemoryAccountRepository extends AccountRepository {
  readonly accounts = new Map<string, Account>();

  create(account: NewAccount): Promise<Account> {
    const taken = [...this.accounts.values()].some(
      (a) => a.accountNumber === account.accountNumber,
    );
    if (taken) return Promise.reject(new AccountNumberTakenError());
    const now = new Date();
    const created = new Account({
      ...account,
      id: randomUUID(),
      balance: '0.00',
      status: 'ACTIVE',
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.accounts.set(created.id, created);
    return Promise.resolve(created);
  }

  findById(id: string): Promise<Account | null> {
    return Promise.resolve(this.accounts.get(id) ?? null);
  }

  findByUserId(userId: string): Promise<Account[]> {
    return Promise.resolve(
      [...this.accounts.values()].filter((a) => a.isOwnedBy(userId)),
    );
  }

  /** Test helper: insert an account with arbitrary state. */
  seed(
    props: Partial<ConstructorParameters<typeof Account>[0]> & {
      userId: string;
    },
  ): Account {
    const now = new Date();
    const account = new Account({
      id: randomUUID(),
      accountNumber: String(this.accounts.size).padStart(12, '1'),
      currency: 'DOP',
      balance: '0.00',
      status: 'ACTIVE',
      version: 0,
      createdAt: now,
      updatedAt: now,
      ...props,
    });
    this.accounts.set(account.id, account);
    return account;
  }
}

/** Deterministic, fast stand-in for argon2. */
export class FakePasswordHasher extends PasswordHasher {
  readonly verify = vi.fn((hash: string, plain: string) =>
    Promise.resolve(hash === `hashed:${plain}`),
  );
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
}

export class FakeTokenService extends TokenService {
  issue(user: AuthenticatedUser): Promise<string> {
    return Promise.resolve(`token-for:${user.id}`);
  }
  verify(token: string): Promise<AuthenticatedUser | null> {
    const id = token.startsWith('token-for:')
      ? token.slice('token-for:'.length)
      : null;
    return Promise.resolve(id ? { id, email: `${id}@test.local` } : null);
  }
}
