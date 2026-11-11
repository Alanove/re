import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions } from '@/components/navigation';

export default function AdminInvoicesLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: t('admin.invoicesTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('admin.invoiceDetail') }} />
      <Stack.Screen name="new" options={{ title: t('admin.newInvoice') }} />
    </Stack>
  );
}
