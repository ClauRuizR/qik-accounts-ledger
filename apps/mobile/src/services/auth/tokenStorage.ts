import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'qik.accessToken';

/**
 * Access token persistence in the platform keystore (iOS Keychain / Android
 * Keystore-backed storage) — never AsyncStorage.
 */
export const tokenStorage = {
  get: (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string): Promise<void> => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(TOKEN_KEY),
};
