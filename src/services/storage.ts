import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Non-sensitive key/value storage (preferences). When real auth arrives,
 * tokens belong in expo-secure-store, not here.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const appStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const STORAGE_KEYS = {
  preferences: 'darb.preferences',
} as const;
