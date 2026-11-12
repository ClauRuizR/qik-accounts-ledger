import {
  FakePasswordHasher,
  FakeTokenService,
  InMemoryUserRepository,
} from '../../../../test-support/fakes.js';
import { RegisterUserUseCase } from './register-user.use-case.js';

describe('RegisterUserUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new RegisterUserUseCase(
      users,
      new FakePasswordHasher(),
      new FakeTokenService(),
    );
  });

  it('creates a user with a normalized email and a hashed password', async () => {
    const result = await useCase.execute({
      email: '  Ana@Qik.DO ',
      password: 'secret-pass',
    });

    expect(result.user.email).toBe('ana@qik.do');
    expect(result.accessToken).toBe(`token-for:${result.user.id}`);
    const stored = await users.findById(result.user.id);
    expect(stored?.passwordHash).toBe('hashed:secret-pass');
  });

  it('never returns the password hash', async () => {
    const result = await useCase.execute({
      email: 'a@qik.do',
      password: 'secret-pass',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an email that is already registered, case-insensitively', async () => {
    await useCase.execute({ email: 'a@qik.do', password: 'secret-pass' });
    await expect(
      useCase.execute({ email: 'A@QIK.DO', password: 'other-pass' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });
});
