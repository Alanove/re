import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LogoTitle, tabOptions } from '@/components/navigation';
import { tabIcon } from '@/components/tabIcon';

export default function MemberLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('member.tabs.home'),
          headerTitle: () => <LogoTitle title={t('common.appName')} />,
          tabBarIcon: tabIcon('home-outline')
        }}
      />
      <Tabs.Screen
        name="apartments"
        options={{ title: t('member.tabs.apartments'), headerShown: false, tabBarIcon: tabIcon('office-building-outline') }}
      />
      <Tabs.Screen name="invoices" options={{ title: t('member.tabs.invoices'), tabBarIcon: tabIcon('file-document-outline') }} />
      <Tabs.Screen name="transactions" options={{ title: t('member.tabs.history'), tabBarIcon: tabIcon('history') }} />
      <Tabs.Screen name="profile" options={{ title: t('member.tabs.profile'), tabBarIcon: tabIcon('account-circle-outline') }} />
      <Tabs.Screen name="wallet" options={{ title: t('member.tabs.wallet'), href: null }} />
    </Tabs>
  );
}
