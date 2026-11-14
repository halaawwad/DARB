import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/navigation/TabBar';
import { ROLE_TABS, type TabName } from '@/components/navigation/roleTabs';
import { usePreferencesStore } from '@/store/preferencesStore';

/**
 * Tabs change by role (see roleTabs). The tab bar is fully custom, so the
 * default header/bar chrome is switched off; `href: null` keeps a role's
 * hidden tabs out of linking.
 */
export default function TabsLayout() {
  const role = usePreferencesStore((s) => s.role);
  if (!role) return <Redirect href="/role" />;

  const hidden = (tab: TabName) => (ROLE_TABS[role].includes(tab) ? undefined : null);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="map" options={{ href: hidden('map') }} />
      <Tabs.Screen name="customers" options={{ href: hidden('customers') }} />
      <Tabs.Screen name="orders" options={{ href: hidden('orders') }} />
      <Tabs.Screen name="finance" options={{ href: hidden('finance') }} />
      <Tabs.Screen name="profile" options={{ href: hidden('profile') }} />
    </Tabs>
  );
}
