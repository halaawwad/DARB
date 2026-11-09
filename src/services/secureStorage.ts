import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { appStorage } from '@/services/storage';

const native = Platform.OS !== 'web';

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (native) return SecureStore.getItemAsync(key);
    return (await appStorage.getItem(key)) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (native) await SecureStore.setItemAsync(key, value);
    else await appStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (native) await SecureStore.deleteItemAsync(key);
    else await appStorage.removeItem(key);
  },
};