import { StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { List, Text } from 'react-native-paper';
import { Card, InfoGrid, TotalDue } from '@/components/ui';
import { brand } from '@/theme';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { AmountText } from '@/components/AmountText';
import { InvoiceRow, TransactionRow, WalletEntryRow } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { SITE_URL } from '@/config';

export default function ApartmentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apartmentId = Number(id);
  const detail = useQuery({
    queryKey: ['member', 'apartment', apartmentId],
    queryFn: () => memberApi.apartment(apartmentId)
  });

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const { apartment, paymentsDue, transactions, wallet } = detail.data;
  const totalDue = paymentsDue.reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => detail.refetch()}>
      <Stack.Screen options={{ title: apartment.label }} />

      <Card style={styles.overflow}>
        {apartment.officialImage ? (
          <Card.Cover source={{ uri: `${SITE_URL}${apartment.officialImage}` }} style={styles.cover} />
        ) : null}
        <Card.Title title={apartment.label} />
        <Card.Content style={styles.body}>
          <InfoGrid
            items={[
              {
                label: t('member.role'),
                value: apartment.isPrimaryOwner ? t('common.primaryOwner') : t(`common.${apartment.memberRole}`)
              },
              apartment.areaInM2 ? { label: t('member.area'), value: `${apartment.areaInM2} m²` } : null,
              apartment.status ? { label: t('member.status'), value: apartment.status } : null,
              apartment.ownerName ? { label: t('common.owner'), value: apartment.ownerName } : null,
              apartment.renterName ? { label: t('common.tenant'), value: apartment.renterName } : null
            ]}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title={t('member.paymentsDue')} />
        {paymentsDue.length === 0 ? (
          <Card.Content style={styles.body}>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('member.allPaid')}
            </Text>
          </Card.Content>
        ) : (
          <>
            {paymentsDue.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} subtitle="" />
            ))}
            <Card.Content style={styles.body}>
              <TotalDue label={t('member.totalDue')} amount={totalDue} />
            </Card.Content>
          </>
        )}
      </Card>

      {wallet ? (
        <Card>
          <Card.Title
            title={t('member.walletBalance')}
            left={(props) => <List.Icon {...props} color={brand.primary} icon="wallet-outline" />}
            right={() => <AmountText value={wallet.balance} variant="titleMedium" style={styles.titleRight} />}
          />
          {wallet.entries.slice(0, 5).map((entry) => (
            <WalletEntryRow key={entry.id} entry={entry} />
          ))}
        </Card>
      ) : null}

      <Card>
        <Card.Title title={t('member.recentPayments')} />
        {transactions.length === 0 ? (
          <Card.Content style={styles.body}>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('member.noPayments')}
            </Text>
          </Card.Content>
        ) : (
          transactions.slice(0, 10).map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overflow: { overflow: 'hidden' },
  cover: { height: 180, borderRadius: 0 },
  body: { paddingBottom: 16 },
  muted: { color: brand.lightText },
  titleRight: { marginRight: 16 }
});
