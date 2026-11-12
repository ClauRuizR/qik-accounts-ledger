import type { MockLink } from '@apollo/client/testing';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { TransactionHistoryScreen } from '../transactions/TransactionHistoryScreen';
import { ACCOUNT, ACCOUNT_TRANSACTIONS } from '../../services/graphql/operations';
import type { TransactionFilters } from '../../types/models';
import { account, connection, graphQLErrorResult, transaction } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { renderWithProviders } from '../../test-utils/render';
import { endOfDayIso, parseDateInput, startOfDayIso } from '../../utils/date';

const accountMock: MockLink.MockedResponse = {
  request: { query: ACCOUNT, variables: { id: 'acc-1' } },
  result: { data: { account: account() } },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

const historyMock = (
  filters: TransactionFilters & { after?: string },
  data: ReturnType<typeof connection>,
): MockLink.MockedResponse => ({
  request: {
    query: ACCOUNT_TRANSACTIONS,
    variables: { accountId: 'acc-1', filters: { ...filters, first: 20 } },
  },
  result: { data: { accountTransactions: data } },
});

const credit = transaction({ id: 'tx-c', type: 'CREDIT', amount: '100.00', description: 'Salary' });
const debit = transaction({
  id: 'tx-d',
  type: 'DEBIT',
  amount: '40.00',
  balanceAfter: '60.00',
  description: 'Groceries',
});

async function renderScreen(mocks: MockLink.MockedResponse[]) {
  const { props } = appScreenProps('TransactionHistory', { accountId: 'acc-1' });
  await renderWithProviders(<TransactionHistoryScreen {...props} />, {
    mocks: [accountMock, ...mocks],
  });
}

const openFilters = () => fireEvent.press(screen.getByTestId('toggle-filters'));

describe('TransactionHistoryScreen', () => {
  it('lists transactions with signed, formatted amounts and a total count', async () => {
    await renderScreen([historyMock({ sortOrder: 'DESC' }, connection([debit, credit]))]);

    expect(await screen.findByText('Groceries')).toBeOnTheScreen();
    const debitRow = screen.getByTestId('transaction-tx-d');
    expect(within(debitRow).getByText('−RD$ 40.00')).toBeOnTheScreen();
    expect(within(debitRow).getByText('Balance RD$ 60.00')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('transaction-tx-c')).getByText('+RD$ 100.00'),
    ).toBeOnTheScreen();
    expect(screen.getByText('2 transactions')).toBeOnTheScreen();
  });

  it('applies type, date range and sort filters', async () => {
    const start = startOfDayIso(parseDateInput('2026-11-01')!);
    const end = endOfDayIso(parseDateInput('2026-11-15')!);
    await renderScreen([
      historyMock({ sortOrder: 'DESC' }, connection([debit, credit])),
      historyMock(
        { type: 'DEBIT', startDate: start, endDate: end, sortOrder: 'ASC' },
        connection([debit]),
      ),
    ]);
    await screen.findByText('Salary');

    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Debits' }));
    await fireEvent.changeText(screen.getByTestId('filter-start-date'), '2026-11-01');
    await fireEvent.changeText(screen.getByTestId('filter-end-date'), '2026-11-15');
    await fireEvent.press(screen.getByRole('radio', { name: 'Oldest first' }));
    await fireEvent.press(screen.getByTestId('apply-filters'));

    expect(await screen.findByText('1 transaction')).toBeOnTheScreen();
    expect(screen.getByText('Groceries')).toBeOnTheScreen();
    expect(screen.queryByText('Salary')).not.toBeOnTheScreen();
    expect(screen.getByText('Filters (active)')).toBeOnTheScreen();
  });

  it('validates the date inputs before querying', async () => {
    await renderScreen([historyMock({ sortOrder: 'DESC' }, connection([credit]))]);
    await screen.findByText('Salary');
    await openFilters();

    await fireEvent.changeText(screen.getByTestId('filter-start-date'), '2026-02-30');
    await fireEvent.press(screen.getByTestId('apply-filters'));
    expect(screen.getByText('Use the format YYYY-MM-DD')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('filter-start-date'), '2026-11-20');
    await fireEvent.changeText(screen.getByTestId('filter-end-date'), '2026-11-10');
    await fireEvent.press(screen.getByTestId('apply-filters'));
    expect(screen.getByText('End date must be on or after the start date')).toBeOnTheScreen();
    // The filter panel is still open: no new query was issued.
    expect(screen.getByTestId('transaction-filters')).toBeOnTheScreen();
  });

  it('distinguishes "no transactions" from "no matches" and can clear filters', async () => {
    await renderScreen([
      historyMock({ sortOrder: 'DESC' }, connection([])),
      historyMock({ type: 'CREDIT', sortOrder: 'DESC' }, connection([])),
      historyMock({ sortOrder: 'DESC' }, connection([credit])),
    ]);
    expect(await screen.findByText('No transactions yet')).toBeOnTheScreen();

    await openFilters();
    await fireEvent.press(screen.getByRole('radio', { name: 'Credits' }));
    await fireEvent.press(screen.getByTestId('apply-filters'));
    expect(await screen.findByText('No matching transactions')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Salary')).toBeOnTheScreen();
  });

  it('loads the next page when the end of the list is reached', async () => {
    const page2Item = transaction({ id: 'tx-old', description: 'Older payment' });
    await renderScreen([
      historyMock(
        { sortOrder: 'DESC' },
        connection([debit, credit], { hasNextPage: true, endCursor: 'cursor-2', totalCount: 3 }),
      ),
      historyMock(
        { sortOrder: 'DESC', after: 'cursor-2' },
        connection([page2Item], { totalCount: 3 }),
      ),
    ]);
    await screen.findByText('Salary');
    expect(screen.queryByText('Older payment')).not.toBeOnTheScreen();

    await fireEvent(screen.getByTestId('transaction-list'), 'onEndReached');

    expect(await screen.findByText('Older payment')).toBeOnTheScreen();
    // Earlier pages are kept (merged by the cache policy).
    expect(screen.getByText('Salary')).toBeOnTheScreen();
    expect(screen.getByText('Groceries')).toBeOnTheScreen();
  });

  it('shows an error state when the history cannot be loaded', async () => {
    await renderScreen([
      {
        request: {
          query: ACCOUNT_TRANSACTIONS,
          variables: { accountId: 'acc-1', filters: { sortOrder: 'DESC', first: 20 } },
        },
        result: graphQLErrorResult('ACCOUNT_NOT_FOUND'),
      },
    ]);
    expect(await screen.findByText('Account not found.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
