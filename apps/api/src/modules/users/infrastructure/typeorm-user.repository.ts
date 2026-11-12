import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../common/errors/postgres-errors.js';
import type { User } from '../domain/user.js';
import { EmailAlreadyRegisteredError } from '../domain/user.errors.js';
import { type NewUser, UserRepository } from '../domain/user.repository.js';
import { UserOrmEntity } from './user.orm-entity.js';

const toDomain = (row: UserOrmEntity): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  createdAt: row.createdAt,
});

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.users.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Matches the unique index on lower(email).
    const row = await this.users
      .createQueryBuilder('u')
      .where('lower(u.email) = lower(:email)', { email })
      .getOne();
    return row ? toDomain(row) : null;
  }

  async create(user: NewUser): Promise<User> {
    try {
      const row = await this.users.save(this.users.create(user));
      return toDomain(row);
    } catch (error) {
      // The unique index makes concurrent registrations of the same email safe.
      if (isUniqueViolation(error, 'users_email_lower_uq')) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
