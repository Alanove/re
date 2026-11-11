import { StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { IconButton, List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { useCanWrite } from '@/components/admin';
import { LogoTitle } from '@/components/navigation';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { Button, Card, Eyebrow, StatTile } from '@/components/ui';
import { brand, fontFamilies, statusColors } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { setMode } = useAuth();
  const canWrite = useCanWrite();
  const dashboard = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard });

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => <LogoTitle title={t('common.appName')} />,
        headerRight: () => (
          <IconButton icon="account-circle-outline" iconColor={brand.primary} onPress={() => router.push('/admin/profile')} />
        )
      }}
    />
  );

  if (dashboard.isPending) return <>{header}<LoadingState /></>;
  if (dashboard.isError) return <>{header}<ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} /></>;

  const data = dashboard.data;
  const pending = data.pendingAccessRequests;

  return (
    <Screen refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()}>
      {header}

      <View style={styles.welcome}>
        <Eyebrow>{t('admin.mode')}</Eyebrow>
        <Text variant="headlineSmall" style={styles.heading}>
          {t('admin.dashboardTitle')}
        </Text>
      </View>

      <Card onPress={() => router.push('/admin/access-requests')}>
        <List.Item
          title={t('admin.pendingRequests')}
          titleStyle={styles.itemTitle}
          left={(props) => <List.Icon {...props} color={brand.primary} icon="account-clock-outline" />}
          right={() => (
            <View style={[styles.count, pending > 0 ? styles.countActive : null]}>
              <Text style={[styles.countText, pending > 0 ? styles.countTextActive : null]}>{pending}</Text>
            </View>
          )}
        />
      </Card>

      <View style={styles.grid}>
        <StatTile
          style={styles.tile}
          label={t('admin.unpaidInvoices')}
          value={formatMoney(data.unpaidInvoices.totalBalance)}
          valueColor={data.unpaidInvoices.totalBalance > 0 ? statusColors.unpaid : statusColors.paid}
          hint={t('admin.unpaidCount', { count: data.unpaidInvoices.count })}
          onPress={() => router.push('/admin/invoices')}
        />
        <StatTile
          style={styles.tile}
          label={t('admin.walletTotal')}
          value={formatMoney(data.wallets.totalBalance)}
          hint={t('admin.walletApartments', { count: data.wallets.apartmentsWithBalance })}
          onPress={() => router.push('/admin/wallets')}
        />
      </View>

      <Card onPress={() => router.push('/admin/transactions')}>
        <Card.Title title={t('admin.tabs.transactions')} />
        <Card.Content style={styles.totals}>
          <Total label={t('admin.income')} value={data.transactions.totalIncome} color={statusColors.income} />
          <Total label={t('admin.expenses')} value={data.transactions.totalExpenses} color={statusColors.expense} />
          <Total
            label={t('admin.netBalance')}
            value={data.transactions.balance}
            color={data.transactions.balance < 0 ? statusColors.expense : brand.accent}
          />
        </Card.Content>
      </Card>

      {canWrite ? (
        <Card>
          <Card.Title title={t('admin.quickActions')} />
          <Card.Content style={styles.actions}>
            <Button mode="contained" icon="plus" onPress={() => router.push('/admin/transactions/new')}>
              {t('admin.newTransaction')}
            </Button>
            <Button mode="contained" tone="secondary" icon="file-plus-outline" onPress={() => router.push('/admin/invoices/new')}>
              {t('admin.newInvoice')}
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Button mode="outlined" icon="home-city-outline" onPress={() => setMode('member')}>
        {t('admin.switchToMember')}
      </Button>
    </Screen>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.total}>
      <Eyebrow>{label}</Eyebrow>
      <Text variant="titleMedium" style={[styles.totalValue, { color }]}>
        {formatMoney(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { gap: 2, paddingHorizontal: 4 },
  heading: { color: brand.darkText, fontFamily: fontFamilies.bold },
  itemTitle: { color: brand.darkText, fontFamily: fontFamilies.medium },
  count: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: brand.beige
  },
  countActive: { backgroundColor: brand.primary },
  countText: { color: brand.darkText, fontFamily: fontFamilies.bold },
  countTextActive: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  totals: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16 },
  total: { alignItems: 'center', gap: 4, flex: 1 },
  totalValue: { fontFamily: fontFamilies.bold },
  actions: { gap: 10, paddingBottom: 16 }
});
