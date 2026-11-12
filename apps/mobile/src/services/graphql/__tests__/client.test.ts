import { createApolloClient } from '../client';
import { MY_ACCOUNTS } from '../operations';

type FetchArgs = [string, { headers: Record<string, string> }];

function mockFetch(body: unknown) {
  const fetchMock = jest.fn((..._args: FetchArgs) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const headersOf = (fetchMock: ReturnType<typeof mockFetch>) =>
  new Headers(fetchMock.mock.calls[0][1].headers);

describe('Apollo client links', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends the current token as a Bearer header', async () => {
    const fetchMock = mockFetch({ data: { myAccounts: [] } });
    const client = createApolloClient({ getToken: () => 'jwt-123', onUnauthenticated: jest.fn() });

    await client.query({ query: MY_ACCOUNTS });
    expect(headersOf(fetchMock).get('authorization')).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when signed out', async () => {
    const fetchMock = mockFetch({ data: { myAccounts: [] } });
    const client = createApolloClient({ getToken: () => null, onUnauthenticated: jest.fn() });

    await client.query({ query: MY_ACCOUNTS });
    expect(headersOf(fetchMock).has('authorization')).toBe(false);
  });

  it('ends the session when the API reports UNAUTHENTICATED', async () => {
    mockFetch({
      data: null,
      errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }],
    });
    const onUnauthenticated = jest.fn();
    const client = createApolloClient({ getToken: () => 'expired', onUnauthenticated });

    await expect(client.query({ query: MY_ACCOUNTS })).rejects.toThrow('Authentication required');
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('does not end the session for other errors', async () => {
    mockFetch({
      data: null,
      errors: [{ message: 'Account not found', extensions: { code: 'ACCOUNT_NOT_FOUND' } }],
    });
    const onUnauthenticated = jest.fn();
    const client = createApolloClient({ getToken: () => 'jwt', onUnauthenticated });

    await expect(client.query({ query: MY_ACCOUNTS })).rejects.toThrow();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
