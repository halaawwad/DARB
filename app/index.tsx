import { Redirect } from 'expo-router';

import { homeRoute } from '@/components/navigation/roleTabs';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Boot route. The root layout has already restored the session by the time this
 * renders: signed in -> the role's home tab, otherwise the login screen.
 */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const role = usePreferencesStore((s) => s.role);
  return <Redirect href={status === 'signedIn' && role ? homeRoute(role) : '/login'} />;
}