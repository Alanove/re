import { useEffect, useState } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold, useFonts } from '@expo-google-fonts/roboto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { ApiRequestError } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { FeedbackProvider } from '@/components/FeedbackProvider';
import { headerOptions } from '@/components/navigation';
import { loadSavedLanguage } from '@/i18n';
import { brand, theme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      }
    }
  }
});

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: brand.primary,
    background: brand.cream,
    card: brand.white,
    text: brand.darkText,
    border: brand.border,
    notification: brand.primary
  }
};

function RootNavigator() {
  const { t } = useTranslation();
  const { status, mode, user } = useAuth();
  const signedIn = status === 'signedIn';

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  return (
    <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mode === 'member'}>
        <Stack.Screen name="member" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mode === 'admin' && Boolean(user?.isAdmin)}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="receipt" options={{ headerShown: true, title: t('common.receipt'), presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [languageReady, setLanguageReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });

  useEffect(() => {
    loadSavedLanguage().finally(() => setLanguageReady(true));
  }, []);

  if (!languageReady || (!fontsLoaded && !fontError)) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="dark" />
          <FeedbackProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
