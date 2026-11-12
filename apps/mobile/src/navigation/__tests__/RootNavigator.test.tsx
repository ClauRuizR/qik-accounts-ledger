import { screen } from '@testing-library/react-native';
import { MY_ACCOUNTS } from '../../services/graphql/operations';
import { createAuthMock, renderWithProviders } from '../../test-utils/render';
import { RootNavigator } from '../RootNavigator';

describe('RootNavigator', () => {
  it('renders nothing but a loader until the stored session is read', async () => {
    await renderWithProviders(<RootNavigator />, { auth: createAuthMock({ status: 'loading' }) });
    expect(screen.getByText('Starting…')).toBeOnTheScreen();
    expect(screen.queryByTestId('email-input')).not.toBeOnTheScreen();
  });

  it('only exposes the sign-in flow when signed out', async () => {
    await renderWithProviders(<RootNavigator />, { auth: createAuthMock({ status: 'signedOut' }) });
    expect(await screen.findByTestId('email-input')).toBeOnTheScreen();
    expect(screen.queryByText('My accounts')).not.toBeOnTheScreen();
  });

  it('opens on the accounts list when signed in', async () => {
    await renderWithProviders(<RootNavigator />, {
      auth: createAuthMock({ status: 'signedIn' }),
      mocks: [{ request: { query: MY_ACCOUNTS }, result: { data: { myAccounts: [] } } }],
    });
    expect(await screen.findByText('No accounts yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('email-input')).not.toBeOnTheScreen();
  });
});
