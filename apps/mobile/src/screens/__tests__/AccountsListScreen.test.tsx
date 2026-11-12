import { fireEvent, screen } from '@testing-library/react-native';
import { AccountsListScreen } from '../accounts/AccountsListScreen';
import { MY_ACCOUNTS } from '../../services/graphql/operations';
import { account, graphQLErrorResult } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { createAuthMock, renderWithProviders } from '../../test-utils/render';

const myAccounts = (accounts: ReturnType<typeof account>[]) => ({
  request: { query: MY_ACCOUNTS },
  result: { data: { myAccounts: accounts } },
});

describe('AccountsListScreen', () => {
  it('shows a loading state, then the accounts with formatted balances', async () => {
    const { props } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, {
      mocks: [
        myAccounts([
          account(),
          account({ id: 'acc-2', accountNumber: '200000000006', currency: 'USD', balance: '0.00' }),
        ]),
      ],
    });

    expect(screen.getByTestId('loading-state')).toBeOnTheScreen();
    expect(await screen.findByText('RD$ 1,500.50')).toBeOnTheScreen();
    expect(screen.getByText('US$ 0.00')).toBeOnTheScreen();
    expect(screen.getByText('1000 0000 0008')).toBeOnTheScreen();
    expect(screen.queryByTestId('loading-state')).not.toBeOnTheScreen();
  });

  it('opens account details when an account is pressed', async () => {
    const { props, navigation } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, {
      mocks: [myAccounts([account()])],
    });

    await fireEvent.press(await screen.findByTestId('account-card-acc-1'));
    expect(navigation.navigate).toHaveBeenCalledWith('AccountDetails', { accountId: 'acc-1' });
  });

  it('shows an empty state that leads to account creation', async () => {
    const { props, navigation } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, { mocks: [myAccounts([])] });

    expect(await screen.findByText('No accounts yet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open an account' }));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateAccount');
  });

  it('shows an error state with retry that recovers', async () => {
    const { props } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, {
      mocks: [
        { request: { query: MY_ACCOUNTS }, error: new TypeError('Network request failed') },
        myAccounts([account()]),
      ],
    });

    expect(
      await screen.findByText('Cannot reach the server. Check your connection and try again.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('RD$ 1,500.50')).toBeOnTheScreen();
  });

  it('shows API errors with a friendly message', async () => {
    const { props } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, {
      mocks: [{ request: { query: MY_ACCOUNTS }, result: graphQLErrorResult('INTERNAL_ERROR') }],
    });
    expect(
      await screen.findByText('Something went wrong on our side. Please try again.'),
    ).toBeOnTheScreen();
  });

  it('adds a working sign-out action to the header', async () => {
    const auth = createAuthMock();
    const { props, navigation } = appScreenProps('Accounts', undefined);
    await renderWithProviders(<AccountsListScreen {...props} />, {
      auth,
      mocks: [myAccounts([])],
    });

    const { headerRight } = navigation.setOptions.mock.calls.at(-1)[0];
    await renderWithProviders(headerRight());
    await fireEvent.press(screen.getByText('Sign out'));
    expect(auth.signOut).toHaveBeenCalled();
  });
});
