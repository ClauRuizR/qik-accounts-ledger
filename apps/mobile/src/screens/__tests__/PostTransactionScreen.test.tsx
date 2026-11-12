import type { MockLink } from '@apollo/client/testing';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PostTransactionScreen } from '../transactions/PostTransactionScreen';
import { ACCOUNT, CREDIT_ACCOUNT, DEBIT_ACCOUNT } from '../../services/graphql/operations';
import { account, graphQLErrorResult, transaction } from '../../test-utils/fixtures';
import { appScreenProps } from '../../test-utils/navigation';
import { renderWithProviders } from '../../test-utils/render';

type PostVariables = {
  input: { accountId: string; amount: string; description?: string; idempotencyKey: string };
};

/** The account query is used by the screen and refetched after a posting. */
const accountMock = (balance = '100.00'): MockLink.MockedResponse => ({
  request: { query: ACCOUNT, variables: { id: 'acc-1' } },
  result: { data: { account: account({ balance }) } },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

/** Captures the variables of every attempt so tests can assert on them. */
function postMock(
  query: typeof CREDIT_ACCOUNT,
  responses: (MockLink.MockedResponse['result'] | Error)[],
  calls: PostVariables[],
): MockLink.MockedResponse[] {
  return responses.map((response) => ({
    request: { query, variables: (vars: PostVariables) => (calls.push(vars), true) },
    ...(response instanceof Error ? { error: response } : { result: response }),
  }));
}

async function renderScreen(type: 'CREDIT' | 'DEBIT', mocks: MockLink.MockedResponse[]) {
  const { props, navigation } = appScreenProps('PostTransaction', { accountId: 'acc-1', type });
  await renderWithProviders(<PostTransactionScreen {...props} />, {
    mocks: [accountMock(), ...mocks],
  });
  await screen.findByTestId('amount-input');
  return navigation;
}

const fill = async (amount: string, description = '') => {
  await fireEvent.changeText(screen.getByTestId('amount-input'), amount);
  if (description) await fireEvent.changeText(screen.getByTestId('description-input'), description);
};
const submit = () => fireEvent.press(screen.getByTestId('post-transaction-submit'));

describe('PostTransactionScreen', () => {
  it('shows the available balance', async () => {
    await renderScreen('CREDIT', []);
    expect(screen.getByText('RD$ 100.00')).toBeOnTheScreen();
  });

  describe('validation (no request is sent)', () => {
    it.each([
      ['', 'Enter an amount'],
      ['0', 'Amount must be greater than zero'],
      ['12.345', 'Use a number with up to 2 decimals, e.g. 150.25'],
      ['abc', 'Use a number with up to 2 decimals, e.g. 150.25'],
    ])('rejects amount %j', async (amount, message) => {
      const calls: PostVariables[] = [];
      await renderScreen('CREDIT', postMock(CREDIT_ACCOUNT, [], calls));
      await fill(amount);
      await submit();
      expect(screen.getByText(message)).toBeOnTheScreen();
      expect(calls).toHaveLength(0);
    });

    it('rejects a debit above the available balance', async () => {
      const calls: PostVariables[] = [];
      await renderScreen('DEBIT', postMock(DEBIT_ACCOUNT, [], calls));
      await fill('100.01');
      await submit();
      expect(screen.getByText('Amount exceeds the available balance')).toBeOnTheScreen();
      expect(calls).toHaveLength(0);
    });
  });

  it('credits the account with a normalized amount and an idempotency key, then closes', async () => {
    const calls: PostVariables[] = [];
    const navigation = await renderScreen(
      'CREDIT',
      postMock(CREDIT_ACCOUNT, [{ data: { creditAccount: transaction() } }], calls),
    );

    await fill('150.5', '  Salary  ');
    await submit();

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toEqual({
      accountId: 'acc-1',
      amount: '150.50',
      description: 'Salary',
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it('keeps the draft and shows the server error when the debit is rejected', async () => {
    const calls: PostVariables[] = [];
    const navigation = await renderScreen(
      'DEBIT',
      postMock(DEBIT_ACCOUNT, [graphQLErrorResult('INSUFFICIENT_FUNDS')], calls),
    );

    await fill('50.00', 'Rent');
    await submit();

    expect(await screen.findByText('Insufficient funds for this debit.')).toBeOnTheScreen();
    expect(screen.getByTestId('amount-input')).toHaveDisplayValue('50.00');
    expect(screen.getByTestId('description-input')).toHaveDisplayValue('Rent');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('retries with the SAME idempotency key after a network failure (no double posting)', async () => {
    const calls: PostVariables[] = [];
    const navigation = await renderScreen(
      'CREDIT',
      postMock(
        CREDIT_ACCOUNT,
        [new TypeError('Network request failed'), { data: { creditAccount: transaction() } }],
        calls,
      ),
    );

    await fill('25.00');
    await submit();
    expect(
      await screen.findByText('Cannot reach the server. Check your connection and try again.'),
    ).toBeOnTheScreen();

    await submit();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());

    expect(calls).toHaveLength(2);
    expect(calls[1].input.idempotencyKey).toBe(calls[0].input.idempotencyKey);
  });

  it('uses a NEW idempotency key when the amount changes after a failure', async () => {
    const calls: PostVariables[] = [];
    await renderScreen(
      'CREDIT',
      postMock(
        CREDIT_ACCOUNT,
        [new TypeError('Network request failed'), { data: { creditAccount: transaction() } }],
        calls,
      ),
    );

    await fill('25.00');
    await submit();
    await screen.findByText('Cannot reach the server. Check your connection and try again.');
    await fill('30.00');
    await submit();

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].input.idempotencyKey).not.toBe(calls[0].input.idempotencyKey);
  });
});
