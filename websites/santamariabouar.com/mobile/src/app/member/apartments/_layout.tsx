import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions } from '@/components/navigation';

export default function ApartmentsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: t('member.tabs.apartments') }} />
      <Stack.Screen name="[id]" options={{ title: t('member.apartmentDetail') }} />
    </Stack>
  );
}
