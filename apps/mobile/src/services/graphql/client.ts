import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { API_URL } from '../../config/env';
import type { TransactionConnection } from '../../types/models';

interface ClientOptions {
  getToken: () => string | null;
  onUnauthenticated: () => void;
}

export function createCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      // Types without an `id` are identified by their account.
      BalanceSummary: { keyFields: ['accountId'] },
      AccountBalance: { keyFields: ['accountId'] },
      Query: {
        fields: {
          accountTransactions: {
            // One cache entry per account + filter combination; `first`/`after`
            // are pagination arguments, not part of the identity.
            keyArgs: ['accountId', 'filters', ['type', 'startDate', 'endDate', 'sortOrder']],
            merge(
              existing: TransactionConnection | undefined,
              incoming: TransactionConnection,
              { args },
            ): TransactionConnection {
              const isNextPage = Boolean((args?.filters as { after?: string } | undefined)?.after);
              if (!existing || !isNextPage) return incoming;
              return { ...incoming, items: [...existing.items, ...incoming.items] };
            },
          },
        },
      },
    },
  });
}

export function createApolloClient({ getToken, onUnauthenticated }: ClientOptions): ApolloClient {
  const authLink = new SetContextLink((prevContext) => {
    const token = getToken();
    return {
      headers: {
        ...(prevContext.headers as Record<string, string> | undefined),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const errorLink = new ErrorLink(({ error }) => {
    const expired =
      CombinedGraphQLErrors.is(error) &&
      error.errors.some((e) => e.extensions?.code === 'UNAUTHENTICATED');
    if (expired) onUnauthenticated();
  });

  return new ApolloClient({
    link: ApolloLink.from([errorLink, authLink, new HttpLink({ uri: API_URL })]),
    cache: createCache(),
  });
}
