import { FinanceSync } from '@/features/finance/hooks';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useLocale } from '@/hooks/useLocale';
import { usePreferencesStore } from '@/store/preferencesStore';
import { WebAppShell } from '@/components/layout/WebAppShell';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

function RootNavigator() {
  const { colors } = useTheme();
  const { isRTL } = useLocale();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        // New screens enter from the reading end: from the left in Arabic.
        animation: isRTL ? 'slide_from_left' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="role" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="customer/[id]" />
      <Stack.Screen name="voice-order" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function AppShell() {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);

  // Safety net: if storage rehydration never reports back (corrupt store, web
  // privacy mode) we still boot rather than sitting on the splash forever.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!usePreferencesStore.getState().hydrated) usePreferencesStore.getState().setHydrated();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // A font download failure must not hold the app hostage — the system font
  // still renders, so an error counts as "done loading".
  const ready = (fontsLoaded || Boolean(fontError)) && prefsHydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    <WebAppShell>
      {ready ? <RootNavigator /> : <View style={{ flex: 1, backgroundColor: colors.deep }} />}
    </WebAppShell>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FinanceSync />
            <AppShell />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
