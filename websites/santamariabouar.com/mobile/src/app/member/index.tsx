import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { PaymentInstructionsCard } from '@/components/PaymentInstructionsCard';
import { InvoiceRow } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { Button, Card, Eyebrow, StatTile, TotalDue } from '@/components/ui';
import { brand, fontFamilies, statusColors } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function MemberHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const dashboard = useQuery({ queryKey: ['member', 'dashboard'], queryFn: memberApi.dashboard });

  if (dashboard.isPending) return <LoadingState />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;

  const data = dashboard.data;
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <Screen refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()}>
      <View style={styles.welcome}>
        <Eyebrow>{t('auth.title')}</Eyebrow>
        <Text variant="headlineSmall" style={styles.heading}>
          {t('member.welcome', { name: firstName })}
        </Text>
      </View>

      <View style={styles.tiles}>
        <StatTile
          style={styles.tile}
          label={t('member.totalDue')}
          value={formatMoney(data.totalDue)}
          valueColor={data.totalDue > 0 ? brand.accent : statusColors.paid}
          onPress={() => router.push('/member/invoices')}
        />
        {data.walletEnabled ? (
          <StatTile
            style={styles.tile}
            label={t('member.walletBalance')}
            value={formatMoney(data.walletTotal || 0)}
            onPress={() => router.push('/member/wallet')}
          />
        ) : (
          <StatTile
            style={styles.tile}
            label={t('member.myApartments')}
            value={String(data.apartments.length)}
            onPress={() => router.push('/member/apartments')}
          />
        )}
      </View>

      <Card>
        <Card.Title
          title={t('member.paymentsDue')}
          right={() =>
            data.paymentsDue.length > 0 ? (
              <Button compact onPress={() => router.push('/member/invoices')} style={styles.titleAction}>
                {t('member.seeAll')}
              </Button>
            ) : null
          }
        />
        {data.paymentsDue.length === 0 ? (
          <Card.Content style={styles.cardBody}>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('member.allPaid')}
            </Text>
          </Card.Content>
        ) : (
          <>
            {data.paymentsDue.slice(0, 5).map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
            <Card.Content style={styles.cardBody}>
              <TotalDue label={t('member.totalDue')} amount={data.totalDue} />
            </Card.Content>
          </>
        )}
      </Card>

      <Card>
        <Card.Title title={t('member.myApartments')} />
        {data.apartments.length === 0 ? (
          <Card.Content style={styles.cardBody}>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('member.noApartments')}
            </Text>
          </Card.Content>
        ) : (
          data.apartments.map((apt) => (
            <List.Item
              key={apt.id}
              title={apt.label}
              titleStyle={styles.itemTitle}
              description={apt.isPrimaryOwner ? t('common.primaryOwner') : t(`common.${apt.memberRole}`)}
              left={(props) => <List.Icon {...props} color={brand.primary} icon="home-city-outline" />}
              right={(props) => <List.Icon {...props} color={brand.lightText} icon="chevron-right" />}
              onPress={() => router.push({ pathname: '/member/apartments/[id]', params: { id: String(apt.id) } })}
            />
          ))
        )}
      </Card>

      {data.totalDue > 0 ? <PaymentInstructionsCard instructions={data.paymentInstructions} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { gap: 4, marginTop: 4 },
  heading: { color: brand.darkText },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  titleAction: { marginRight: 8 },
  cardBody: { paddingBottom: 16 },
  muted: { color: brand.lightText },
  itemTitle: { fontFamily: fontFamilies.medium, color: brand.darkText }
});
