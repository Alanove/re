import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions } from '@/components/navigation';

export default function AccessRequestsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: t('admin.requestsTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('admin.reviewRequest') }} />
    </Stack>
  );
}
