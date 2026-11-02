import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LOCALE, type Locale } from '@/i18n';
import { appStorage, STORAGE_KEYS } from '@/services/storage';
import type { Role } from '@/types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface PreferencesState {
  locale: Locale;
  themeMode: ThemeMode;
  /** Chosen on the role screen — a stand-in for login until auth exists. */
  role?: Role;
  /** True once persisted preferences have been read — describes this run only. */
  hydrated: boolean;

  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setRole: (role?: Role) => void;
  setHydrated: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      themeMode: 'light',
      role: undefined,
      hydrated: false,

      setLocale: (locale) => set({ locale }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setRole: (role) => set({ role }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEYS.preferences,
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (name) => appStorage.getItem(name),
        setItem: (name, value) => appStorage.setItem(name, value),
        removeItem: (name) => appStorage.removeItem(name),
      })),
      partialize: (state) => ({
        locale: state.locale,
        themeMode: state.themeMode,
        role: state.role,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
