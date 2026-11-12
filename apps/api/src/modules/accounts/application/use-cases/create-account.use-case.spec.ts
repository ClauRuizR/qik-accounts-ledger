import { InMemoryAccountRepository } from '../../../../test-support/fakes.js';
import type { AccountNumberGenerator } from '../../domain/account-number.generator.js';
import { CreateAccountUseCase } from './create-account.use-case.js';

const sequence = (...numbers: string[]): AccountNumberGenerator => {
  let i = 0;
  return { generate: () => numbers[Math.min(i++, numbers.length - 1)] };
};

describe('CreateAccountUseCase', () => {
  let accounts: InMemoryAccountRepository;

  beforeEach(() => {
    accounts = new InMemoryAccountRepository();
  });

  it('creates an active DOP account with a zero balance by default', async () => {
    const useCase = new CreateAccountUseCase(
      accounts,
      sequence('100000000009'),
    );
    const account = await useCase.execute({ userId: 'user-1' });

    expect(account.toProps()).toMatchObject({
      userId: 'user-1',
      accountNumber: '100000000009',
      currency: 'DOP',
      balance: '0.00',
      status: 'ACTIVE',
    });
  });

  it('honours the requested currency', async () => {
    const useCase = new CreateAccountUseCase(
      accounts,
      sequence('100000000009'),
    );
    const account = await useCase.execute({
      userId: 'user-1',
      currency: 'USD',
    });
    expect(account.currency).toBe('USD');
  });

  it('retries with a new number when the generated one is taken', async () => {
    accounts.seed({ userId: 'other', accountNumber: '111111111111' });
    const useCase = new CreateAccountUseCase(
      accounts,
      sequence('111111111111', '222222222222'),
    );
    const account = await useCase.execute({ userId: 'user-1' });
    expect(account.accountNumber).toBe('222222222222');
  });

  it('gives up after repeated collisions instead of looping forever', async () => {
    accounts.seed({ userId: 'other', accountNumber: '111111111111' });
    const useCase = new CreateAccountUseCase(
      accounts,
      sequence('111111111111'),
    );
    await expect(useCase.execute({ userId: 'user-1' })).rejects.toThrow(
      'Account number already in use',
    );
  });
});
