import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AuthProvider } from '../AuthContext';

const TOKEN_KEY = 'qik.accessToken';
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthProvider', () => {
  afterEach(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  });

  it('starts signed out when no token is stored', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });

  it('restores the session from SecureStore on launch', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, 'stored-jwt');
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
  });

  it('persists the token on sign-in and removes it on sign-out', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(() => result.current.signIn('fresh-jwt'));
    expect(result.current.status).toBe('signedIn');
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBe('fresh-jwt');

    await act(() => result.current.signOut());
    expect(result.current.status).toBe('signedOut');
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });

  it('requires the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      'useAuth must be used inside <AuthProvider>',
    );
  });
});
