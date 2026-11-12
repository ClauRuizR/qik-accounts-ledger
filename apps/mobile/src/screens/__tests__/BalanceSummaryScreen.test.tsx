import { screen, within } from '@testing-library/react-native';
import { BalanceSummaryScreen } from '../transactions/BalanceSummaryScreen';
import { HISTORY_POINTS } from '../../hooks/useBalanceSummary';
import { BALANCE_SUMMARY } from '../../services/graphql/operations';
import { graphQLErrorResult, summary } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { renderWithProviders } from '../../test-utils/render';

const request = {
  query: BALANCE_SUMMARY,
  variables: { accountId: 'acc-1', historyLimit: HISTORY_POINTS },
};

async function renderScreen(result: object) {
  const { props } = appScreenProps('BalanceSummary', { accountId: 'acc-1' });
  await renderWithProviders(<BalanceSummaryScreen {...props} />, { mocks: [{ request, result }] });
}

describe('BalanceSummaryScreen', () => {
  it('renders balance, totals, count and history (newest first)', async () => {
    await renderScreen({ data: { accountBalanceSummary: summary() } });

    expect(await screen.findByTestId('summary-balance')).toHaveTextContent('RD$ 150.00');
    expect(screen.getByTestId('summary-credits')).toHaveTextContent('+RD$ 200.00');
    expect(screen.getByTestId('summary-debits')).toHaveTextContent('−RD$ 50.00');
    expect(screen.getByTestId('summary-count')).toHaveTextContent('3 transactions in total');

    const history = screen.getByTestId('balance-history');
    const amounts = within(history)
      .getAllByText(/^RD\$/)
      .map((node) => node.props.children as string);
    expect(amounts).toEqual(['RD$ 150.00', 'RD$ 200.00', 'RD$ 100.00']);
  });

  it('handles an account without transactions', async () => {
    await renderScreen({
      data: {
        accountBalanceSummary: summary({
          currentBalance: '0.00',
          totalCredits: '0.00',
          totalDebits: '0.00',
          transactionCount: 0,
          history: [],
        }),
      },
    });
    expect(await screen.findByText('No transactions yet.')).toBeOnTheScreen();
    expect(screen.getByTestId('summary-count')).toHaveTextContent('0 transactions in total');
  });

  it('shows an error state', async () => {
    await renderScreen(graphQLErrorResult('ACCOUNT_NOT_FOUND'));
    expect(await screen.findByText('Account not found.')).toBeOnTheScreen();
  });
});
