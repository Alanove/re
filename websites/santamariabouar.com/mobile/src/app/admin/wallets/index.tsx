import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, List, Switch, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import { AmountText } from '@/components/AmountText';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ListRow, SearchField, StatTile } from '@/components/ui';
import { useDebouncedValue } from '@/components/useDebouncedValue';
import { brand, fontFamilies } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function AdminWalletsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [withBalance, setWithBalance] = useState(true);
  const debouncedSearch = useDebouncedValue(search);

  const wallets = useInfiniteQuery({
    queryKey: ['admin', 'wallets', debouncedSearch, withBalance],
    queryFn: ({ pageParam }) => adminApi.wallets(debouncedSearch, withBalance, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined)
  });

  const items = wallets.data?.pages.flatMap((p) => p.items) ?? [];
  const summary = wallets.data?.pages[0]?.summary;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.apartmentId)}
        contentContainerStyle={styles.list}
        refreshing={wallets.isRefetching && !wallets.isFetchingNextPage}
        onRefresh={() => wallets.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (wallets.hasNextPage && !wallets.isFetchingNextPage) void wallets.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.filters}>
            {summary ? (
              <StatTile
                style={styles.summary}
                label={t('admin.walletTotal')}
                value={formatMoney(summary.totalBalance)}
                valueColor={brand.accent}
                hint={t('admin.walletApartments', { count: summary.apartmentsWithBalance })}
              />
            ) : null}
            <SearchField placeholder={t('common.search')} value={search} onChangeText={setSearch} />
            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={styles.switchLabel}>
                {t('admin.withBalanceOnly')}
              </Text>
              <Switch value={withBalance} onValueChange={setWithBalance} color={brand.primary} />
            </View>
          </View>
        }
        ListEmptyComponent={
          wallets.isPending ? (
            <LoadingState />
          ) : wallets.isError ? (
            <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />
          ) : (
            <EmptyState />
          )
        }
        ListFooterComponent={wallets.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : undefined}
        renderItem={({ item }) => (
          <ListRow>
            <List.Item
              title={item.label}
              titleStyle={styles.rowTitle}
              description={item.ownerName || undefined}
              descriptionStyle={styles.muted}
              left={(props) => <List.Icon {...props} color={brand.primary} icon="wallet-outline" />}
              right={() => <AmountText value={item.balance} style={styles.amount} />}
              onPress={() =>
                router.push({ pathname: '/admin/wallets/[apartmentId]', params: { apartmentId: String(item.apartmentId) } })
              }
            />
          </ListRow>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 24 },
  filters: { padding: 16, gap: 10 },
  summary: { backgroundColor: brand.white },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  switchLabel: { color: brand.darkText },
  rowTitle: { color: brand.darkText, fontFamily: fontFamilies.medium },
  muted: { color: brand.lightText },
  footer: { margin: 16 },
  amount: { alignSelf: 'center' }
});
