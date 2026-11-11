import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'smb.refreshToken';

// SecureStore is native-only; the web preview keeps the token for the tab session.
const webStore = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStore.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),
  clearRefreshToken: () => deleteItem(REFRESH_TOKEN_KEY),
  getItem,
  setItem
};
