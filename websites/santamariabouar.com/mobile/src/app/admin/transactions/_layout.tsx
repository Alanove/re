import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions } from '@/components/navigation';

export default function AdminTransactionsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: t('admin.transactionsTitle') }} />
      <Stack.Screen name="new" options={{ title: t('admin.newTransaction') }} />
    </Stack>
  );
}
