import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi, type InvoiceFilters } from '@/api/endpoints';
import { useCanWrite } from '@/components/admin';
import { InvoiceRow } from '@/components/Rows';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { AddFab, ListRow, SearchField } from '@/components/ui';
import { useDebouncedValue } from '@/components/useDebouncedValue';
import { brand } from '@/theme';
import { formatMoney } from '@/utils/format';

type StatusFilter = NonNullable<InvoiceFilters['status']>;

export default function AdminInvoicesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const canWrite = useCanWrite();
  const [status, setStatus] = useState<StatusFilter>('partial-unpaid');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const invoices = useInfiniteQuery({
    queryKey: ['admin', 'invoices', status, debouncedSearch],
    queryFn: ({ pageParam }) => adminApi.invoices({ status, search: debouncedSearch, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined)
  });

  const items = invoices.data?.pages.flatMap((p) => p.items) ?? [];
  const summary = invoices.data?.pages[0]?.summary;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={invoices.isRefetching && !invoices.isFetchingNextPage}
        onRefresh={() => invoices.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (invoices.hasNextPage && !invoices.isFetchingNextPage) void invoices.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.filters}>
            <SegmentedButtons
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
              buttons={[
                { value: 'partial-unpaid', label: t('admin.filterOutstanding') },
                { value: 'paid', label: t('admin.filterPaid') },
                { value: 'all', label: t('admin.filterAll') }
              ]}
            />
            <SearchField placeholder={t('common.search')} value={search} onChangeText={setSearch} />
            {summary ? (
              <Text variant="labelMedium" style={styles.muted}>
                {t('admin.totalOutstanding', { amount: formatMoney(summary.totalBalance), count: summary.count })}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          invoices.isPending ? (
            <LoadingState />
          ) : invoices.isError ? (
            <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
          ) : (
            <EmptyState />
          )
        }
        ListFooterComponent={invoices.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : undefined}
        renderItem={({ item }) => (
          <ListRow>
            <InvoiceRow
              invoice={item}
              subtitle={[item.apartmentLabel, item.ownerName].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/admin/invoices/[id]', params: { id: String(item.id) } })}
            />
          </ListRow>
        )}
      />
      {canWrite ? <AddFab onPress={() => router.push('/admin/invoices/new')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  filters: { padding: 16, gap: 10 },
  muted: { color: brand.lightText, paddingHorizontal: 4 },
  footer: { margin: 16 }
});
