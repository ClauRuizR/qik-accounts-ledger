import { InMemoryAccountRepository } from '../../../../test-support/fakes.js';
import { GetAccountBalanceUseCase } from './get-account-balance.use-case.js';
import { GetOwnedAccountUseCase } from './get-owned-account.use-case.js';
import { ListMyAccountsUseCase } from './list-my-accounts.use-case.js';

describe('account queries and ownership', () => {
  let accounts: InMemoryAccountRepository;
  let getOwned: GetOwnedAccountUseCase;

  beforeEach(() => {
    accounts = new InMemoryAccountRepository();
    getOwned = new GetOwnedAccountUseCase(accounts);
  });

  it('lists only the accounts of the requesting user', async () => {
    const mine = accounts.seed({ userId: 'alice' });
    accounts.seed({ userId: 'bob' });

    const result = await new ListMyAccountsUseCase(accounts).execute('alice');
    expect(result.map((a) => a.id)).toEqual([mine.id]);
  });

  it('returns an owned account', async () => {
    const account = accounts.seed({ userId: 'alice' });
    await expect(getOwned.execute('alice', account.id)).resolves.toBe(account);
  });

  it("reports another user's account as not found (no existence leak)", async () => {
    const account = accounts.seed({ userId: 'bob' });
    await expect(getOwned.execute('alice', account.id)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('reports a missing account as not found', async () => {
    await expect(
      getOwned.execute('alice', '00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });

  it('returns the current balance of an owned account', async () => {
    const account = accounts.seed({
      userId: 'alice',
      balance: '150.75',
      currency: 'USD',
    });
    const balance = await new GetAccountBalanceUseCase(getOwned).execute(
      'alice',
      account.id,
    );
    expect(balance).toEqual({
      accountId: account.id,
      balance: '150.75',
      currency: 'USD',
      asOf: account.updatedAt,
    });
  });

  it('enforces ownership for balance reads too', async () => {
    const account = accounts.seed({ userId: 'bob', balance: '999.00' });
    await expect(
      new GetAccountBalanceUseCase(getOwned).execute('alice', account.id),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });
});
