import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions } from '@/components/navigation';

export default function AdminWalletsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: t('admin.walletsTitle') }} />
      <Stack.Screen name="[apartmentId]" options={{ title: t('admin.walletDetail') }} />
    </Stack>
  );
}
