import { fireEvent, screen } from '@testing-library/react-native';
import { AccountDetailsScreen } from '../accounts/AccountDetailsScreen';
import { ACCOUNT } from '../../services/graphql/operations';
import { account, graphQLErrorResult } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { renderWithProviders } from '../../test-utils/render';

const accountMock = (overrides = {}) => ({
  request: { query: ACCOUNT, variables: { id: 'acc-1' } },
  result: { data: { account: account(overrides) } },
});

describe('AccountDetailsScreen', () => {
  it('shows the account details and balance', async () => {
    const { props } = appScreenProps('AccountDetails', { accountId: 'acc-1' });
    await renderWithProviders(<AccountDetailsScreen {...props} />, { mocks: [accountMock()] });

    expect(await screen.findByTestId('account-balance')).toHaveTextContent('RD$ 1,500.50');
    expect(screen.getByText('1000 0000 0008')).toBeOnTheScreen();
    expect(screen.getByText('Active')).toBeOnTheScreen();
  });

  it('navigates to credit, debit, history and summary', async () => {
    const { props, navigation } = appScreenProps('AccountDetails', { accountId: 'acc-1' });
    await renderWithProviders(<AccountDetailsScreen {...props} />, { mocks: [accountMock()] });
    await screen.findByTestId('account-balance');

    await fireEvent.press(screen.getByTestId('credit-button'));
    await fireEvent.press(screen.getByTestId('debit-button'));
    await fireEvent.press(screen.getByRole('button', { name: 'Transaction history' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Balance summary' }));

    expect(navigation.navigate.mock.calls).toEqual([
      ['PostTransaction', { accountId: 'acc-1', type: 'CREDIT' }],
      ['PostTransaction', { accountId: 'acc-1', type: 'DEBIT' }],
      ['TransactionHistory', { accountId: 'acc-1' }],
      ['BalanceSummary', { accountId: 'acc-1' }],
    ]);
  });

  it('disables credit and debit for an inactive account', async () => {
    const { props } = appScreenProps('AccountDetails', { accountId: 'acc-1' });
    await renderWithProviders(<AccountDetailsScreen {...props} />, {
      mocks: [accountMock({ status: 'INACTIVE' })],
    });

    expect(await screen.findByText('Inactive')).toBeOnTheScreen();
    expect(screen.getByTestId('credit-button')).toBeDisabled();
    expect(screen.getByTestId('debit-button')).toBeDisabled();
  });

  it('shows not-found errors', async () => {
    const { props } = appScreenProps('AccountDetails', { accountId: 'acc-1' });
    await renderWithProviders(<AccountDetailsScreen {...props} />, {
      mocks: [
        {
          request: { query: ACCOUNT, variables: { id: 'acc-1' } },
          result: graphQLErrorResult('ACCOUNT_NOT_FOUND'),
        },
      ],
    });
    expect(await screen.findByText('Account not found.')).toBeOnTheScreen();
  });
});
