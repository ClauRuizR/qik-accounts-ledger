import { ApolloProvider } from '@apollo/client/react';
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthSession } from '../services/auth/authSession';
import { tokenStorage } from '../services/auth/tokenStorage';
import { createApolloClient } from '../services/graphql/client';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session: hydrates the token from SecureStore on launch, exposes
 * sign-in/out, and provides an Apollo client that sends the token. Signing out
 * (or a server-side UNAUTHENTICATED) wipes the token and the Apollo cache so no
 * financial data from the previous session remains in memory.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session] = useState(() => new AuthSession());
  const [client] = useState(() =>
    createApolloClient({
      getToken: () => session.getToken(),
      onUnauthenticated: () => session.expire(),
    }),
  );

  const signOut = useCallback(async () => {
    session.setToken(null);
    setStatus('signedOut');
    await tokenStorage.clear();
    await client.clearStore();
  }, [client, session]);

  const signIn = useCallback(
    async (accessToken: string) => {
      session.setToken(accessToken);
      await tokenStorage.set(accessToken);
      setStatus('signedIn');
    },
    [session],
  );

  useEffect(() => {
    session.onExpired(() => void signOut());
  }, [session, signOut]);

  useEffect(() => {
    let cancelled = false;
    tokenStorage
      .get()
      .catch(() => null)
      .then((token) => {
        if (cancelled) return;
        session.setToken(token);
        setStatus(token ? 'signedIn' : 'signedOut');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </AuthContext.Provider>
  );
}
