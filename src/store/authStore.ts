import { create } from 'zustand';

import { DEMO_GRANTS } from '@/features/admin/roles';
import { ApiError, configureApiAuth } from '@/services/http/apiClient';
import { fetchMe, requestLogin, requestRegister } from '@/services/http/authService';
import { secureStorage } from '@/services/secureStorage';
import { appStorage } from '@/services/storage';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { AuthUser, LoginInput, RegisterInput, Role } from '@/types';

const TOKEN_KEY = 'darb.auth.token';
const USER_KEY = 'darb.auth.user';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  /** 'server' = real JWT session. 'demo' = role picker with mock data. */
  mode?: 'server' | 'demo';
  token?: string;
  user?: AuthUser;

  restore: () => Promise<void>;
  signIn: (input: LoginInput) => Promise<AuthUser>;
  signUp: (input: RegisterInput) => Promise<AuthUser>;
  signInDemo: (role: Role) => void;
  signOut: () => Promise<void>;
}

function demoUser(role: Role): AuthUser {
  return {
    id: `demo-${role}`,
    companyId: 'demo-company',
    companyName: '',
    email: `${role}@demo.darb`,
    fullName: '',
    roleName: role,
    role,
    permissions: [...DEMO_GRANTS[role]],
  };
}

async function clearStoredSession() {
  await Promise.allSettled([secureStorage.removeItem(TOKEN_KEY), appStorage.removeItem(USER_KEY)]);
}

/** Background refresh of grants. Offline = keep the cached user; a 401 signs out via configureApiAuth. */
async function refreshUser() {
  try {
    const user = await fetchMe();
    if (useAuthStore.getState().mode !== 'server') return;
    if (!user.role) {
      await useAuthStore.getState().signOut();
      return;
    }
    await appStorage.setItem(USER_KEY, JSON.stringify(user));
    usePreferencesStore.getState().setRole(user.role);
    useAuthStore.setState({ user });
  } catch {
    /* keep the cached user */
  }
}

/** Shared by login and signup: the token is saved only after /auth/me confirms the account. */
async function finishSignIn(token: string): Promise<AuthUser> {
  useAuthStore.setState({ token }); // api() reads the token from this store
  try {
    const user = await fetchMe();
    if (!user.role) throw new ApiError('This role has no mobile screens yet.', 403);
    await secureStorage.setItem(TOKEN_KEY, token);
    await appStorage.setItem(USER_KEY, JSON.stringify(user));
    usePreferencesStore.getState().setRole(user.role);
    useAuthStore.setState({ status: 'signedIn', mode: 'server', token, user });
    return user;
  } catch (error) {
    useAuthStore.setState({ token: undefined });
    throw error;
  }
}
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  mode: undefined,
  token: undefined,
  user: undefined,

  async restore() {
    try {
      const token = await secureStorage.getItem(TOKEN_KEY);

      if (!token) {
        // No server session. Keep the old behaviour: a role chosen in the role picker still works.
        const role = usePreferencesStore.getState().role;
        set(role ? { status: 'signedIn', mode: 'demo', user: demoUser(role) } : { status: 'signedOut' });
        return;
      }

      set({ token });
      const cachedRaw = await appStorage.getItem(USER_KEY);
      const cached = cachedRaw ? (JSON.parse(cachedRaw) as AuthUser) : undefined;

      if (cached?.role) {
        // Open instantly from the cache, then refresh grants in the background.
        usePreferencesStore.getState().setRole(cached.role);
        set({ status: 'signedIn', mode: 'server', user: cached });
        void refreshUser();
        return;
      }

      const user = await fetchMe();
      if (!user.role) throw new ApiError('This role has no mobile screens yet.', 403);
      await appStorage.setItem(USER_KEY, JSON.stringify(user));
      usePreferencesStore.getState().setRole(user.role);
      set({ status: 'signedIn', mode: 'server', user });
    } catch {
      await clearStoredSession();
      usePreferencesStore.getState().setRole(undefined);
      set({ status: 'signedOut', mode: undefined, token: undefined, user: undefined });
    }
  },

    async signIn(input) {
      return finishSignIn(await requestLogin(input));
    },

    async signUp(input) {
      return finishSignIn(await requestRegister(input));
    },

  signInDemo(role) {
    usePreferencesStore.getState().setRole(role);
    set({ status: 'signedIn', mode: 'demo', token: undefined, user: demoUser(role) });
  },

   async signOut() {
     await clearStoredSession();
     // Status first, so screens that react to the cleared role already know we're signed out.
     set({ status: 'signedOut', mode: undefined, token: undefined, user: undefined });
     usePreferencesStore.getState().setRole(undefined);
   },
 }));

 configureApiAuth({
   getToken: () => useAuthStore.getState().token,
   onUnauthorized: () => {
     if (useAuthStore.getState().mode === 'server') void useAuthStore.getState().signOut();
   },
 });