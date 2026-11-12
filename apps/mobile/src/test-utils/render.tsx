import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { createCache } from '../services/graphql/client';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createAuthMock(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'signedIn',
    signIn: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

interface Options {
  mocks?: readonly MockLink.MockedResponse[];
  auth?: AuthContextValue;
}

/** Renders with the app's real providers: safe area, auth context, Apollo (mocked network, real cache policies). */
export function renderWithProviders(
  ui: ReactElement,
  { mocks = [], auth = createAuthMock() }: Options = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AuthContext.Provider value={auth}>
        <MockedProvider mocks={mocks} cache={createCache()}>
          {ui}
        </MockedProvider>
      </AuthContext.Provider>
    </SafeAreaProvider>,
  );
}
