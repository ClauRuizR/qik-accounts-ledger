import { InMemoryUserRepository } from '../../../../test-support/fakes.js';
import { GetCurrentUserUseCase } from './get-current-user.use-case.js';

describe('GetCurrentUserUseCase', () => {
  it('returns the public profile of the user', async () => {
    const users = new InMemoryUserRepository();
    const user = await users.create({ email: 'a@qik.do', passwordHash: 'h' });
    const result = await new GetCurrentUserUseCase(users).execute(user.id);
    expect(result).toEqual({
      id: user.id,
      email: 'a@qik.do',
      createdAt: user.createdAt,
    });
  });

  it('treats a token for a deleted user as unauthenticated', async () => {
    await expect(
      new GetCurrentUserUseCase(new InMemoryUserRepository()).execute(
        'missing',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
