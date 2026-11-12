import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CreateAccountScreen } from '../accounts/CreateAccountScreen';
import { CREATE_ACCOUNT, MY_ACCOUNTS } from '../../services/graphql/operations';
import { account, graphQLErrorResult } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { renderWithProviders } from '../../test-utils/render';

describe('CreateAccountScreen', () => {
  it('defaults to DOP', async () => {
    const { props } = appScreenProps('CreateAccount', undefined);
    await renderWithProviders(<CreateAccountScreen {...props} />);
    expect(screen.getByRole('radio', { name: 'DOP' })).toBeSelected();
  });

  it('creates an account in the chosen currency and opens it', async () => {
    const { props, navigation } = appScreenProps('CreateAccount', undefined);
    const created = account({ id: 'new-acc', currency: 'USD', balance: '0.00' });
    await renderWithProviders(<CreateAccountScreen {...props} />, {
      mocks: [
        {
          request: { query: CREATE_ACCOUNT, variables: { input: { currency: 'USD' } } },
          result: { data: { createAccount: created } },
        },
        { request: { query: MY_ACCOUNTS }, result: { data: { myAccounts: [created] } } },
      ],
    });

    await fireEvent.press(screen.getByRole('radio', { name: 'USD' }));
    expect(screen.getByRole('radio', { name: 'USD' })).toBeSelected();
    await fireEvent.press(screen.getByTestId('create-account-submit'));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('AccountDetails', { accountId: 'new-acc' }),
    );
  });

  it('shows an error and stays on the form when creation fails', async () => {
    const { props, navigation } = appScreenProps('CreateAccount', undefined);
    await renderWithProviders(<CreateAccountScreen {...props} />, {
      mocks: [
        {
          request: { query: CREATE_ACCOUNT, variables: { input: { currency: 'DOP' } } },
          result: graphQLErrorResult('INTERNAL_ERROR'),
        },
      ],
    });

    await fireEvent.press(screen.getByTestId('create-account-submit'));
    expect(
      await screen.findByText('Something went wrong on our side. Please try again.'),
    ).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
