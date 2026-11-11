import { StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, StatTile } from '@/components/ui';
import { formatMoney } from '@/utils/format';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { AmountText } from '@/components/AmountText';
import { WalletEntryRow } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function MemberWalletScreen() {
  const { t } = useTranslation();
  const wallet = useQuery({ queryKey: ['member', 'wallet'], queryFn: memberApi.wallet });

  if (wallet.isPending) return <LoadingState />;
  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={() => wallet.refetch()} />;
  if (!wallet.data.walletEnabled) return <EmptyState message={t('member.walletDisabled')} />;

  return (
    <Screen refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()}>
      <StatTile label={t('member.walletBalance')} value={formatMoney(wallet.data.total)} />
      {wallet.data.wallets.map((item) => (
        <Card key={item.apartmentId} mode="outlined">
          <Card.Title
            title={item.apartmentLabel}
            subtitle={t('member.walletEntries')}
            right={() => <AmountText value={item.balance} variant="titleMedium" style={styles.titleRight} />}
          />
          {item.entries.length === 0 ? <EmptyState /> : item.entries.map((entry) => <WalletEntryRow key={entry.id} entry={entry} />)}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRight: { marginRight: 16 }
});
