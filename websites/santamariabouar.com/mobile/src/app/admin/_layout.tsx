import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { tabOptions } from '@/components/navigation';
import { tabIcon } from '@/components/tabIcon';

export default function AdminLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ ...tabOptions, headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('admin.tabs.dashboard'), headerShown: true, tabBarIcon: tabIcon('view-dashboard-outline') }}
      />
      <Tabs.Screen name="transactions" options={{ title: t('admin.tabs.transactions'), tabBarIcon: tabIcon('swap-horizontal') }} />
      <Tabs.Screen name="invoices" options={{ title: t('admin.tabs.invoices'), tabBarIcon: tabIcon('file-document-outline') }} />
      <Tabs.Screen name="wallets" options={{ title: t('admin.tabs.wallets'), tabBarIcon: tabIcon('wallet-outline') }} />
      <Tabs.Screen
        name="access-requests"
        options={{ title: t('admin.tabs.requests'), tabBarIcon: tabIcon('account-clock-outline') }}
      />
      <Tabs.Screen name="profile" options={{ title: t('member.profileTitle'), headerShown: true, href: null }} />
    </Tabs>
  );
}
