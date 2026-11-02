import { Redirect } from 'expo-router';
import { usePreferencesStore } from '@/store/preferencesStore';
import { homeRoute } from '@/components/navigation/roleTabs';

/**
 * Boot route. The root layout has already hydrated preferences by the time
 * this renders, so this is a pure decision with no loading state of its own.
 */
export default function Index() {
  const role = usePreferencesStore((s) => s.role);
  return <Redirect href={role ? homeRoute(role) : '/role'} />;
}
