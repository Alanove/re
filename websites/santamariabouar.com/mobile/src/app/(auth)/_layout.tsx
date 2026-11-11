import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, LogoTitle } from '@/components/navigation';

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ ...headerOptions, headerTitle: () => <LogoTitle /> }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" options={{ headerBackTitle: t('auth.backToLogin') }} />
      <Stack.Screen name="request-access" options={{ headerBackTitle: t('auth.backToLogin') }} />
    </Stack>
  );
}
