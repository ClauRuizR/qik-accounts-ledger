import {
  FakePasswordHasher,
  FakeTokenService,
  InMemoryUserRepository,
} from '../../../../test-support/fakes.js';
import { LoginUserUseCase } from './login-user.use-case.js';

describe('LoginUserUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let useCase: LoginUserUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    useCase = new LoginUserUseCase(users, hasher, new FakeTokenService());
    await users.create({
      email: 'ana@qik.do',
      passwordHash: 'hashed:right-pass',
    });
  });

  it('issues a token for valid credentials (email is case-insensitive)', async () => {
    const result = await useCase.execute({
      email: 'ANA@qik.do',
      password: 'right-pass',
    });
    expect(result.user.email).toBe('ana@qik.do');
    expect(result.accessToken).toBe(`token-for:${result.user.id}`);
  });

  it('rejects a wrong password with a generic error', async () => {
    await expect(
      useCase.execute({ email: 'ana@qik.do', password: 'wrong-pass' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('rejects an unknown email with the same error, still running a hash check', async () => {
    await expect(
      useCase.execute({ email: 'nobody@qik.do', password: 'right-pass' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });
});
