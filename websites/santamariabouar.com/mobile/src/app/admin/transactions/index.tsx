import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { AdminTransaction, ApartmentOption } from '@/api/types';
import { searchApartments, useCanWrite } from '@/components/admin';
import { AmountText } from '@/components/AmountText';
import { ApartmentPicker } from '@/components/ApartmentPicker';
import { openReceipt } from '@/components/Rows';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { AddFab, ListRow, SearchField } from '@/components/ui';
import { useDebouncedValue } from '@/components/useDebouncedValue';
import { brand, fontFamilies, statusColors } from '@/theme';
import { formatDate } from '@/utils/format';

export default function AdminTransactionsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const canWrite = useCanWrite();
  const [keyword, setKeyword] = useState('');
  const [apartment, setApartment] = useState<ApartmentOption | null>(null);
  const debouncedKeyword = useDebouncedValue(keyword);

  const transactions = useInfiniteQuery({
    queryKey: ['admin', 'transactions', debouncedKeyword, apartment?.id ?? null],
    queryFn: ({ pageParam }) =>
      adminApi.transactions({ keyword: debouncedKeyword, apartmentId: apartment?.id, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined)
  });

  const items = transactions.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={transactions.isRefetching && !transactions.isFetchingNextPage}
        onRefresh={() => transactions.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (transactions.hasNextPage && !transactions.isFetchingNextPage) void transactions.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.filters}>
            <SearchField placeholder={t('admin.keyword')} value={keyword} onChangeText={setKeyword} />
            <ApartmentPicker value={apartment} onChange={setApartment} search={searchApartments} allowClear />
            {transactions.data ? (
              <Text variant="labelMedium" style={styles.muted}>
                {transactions.data.pages[0]?.total ?? 0}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          transactions.isPending ? (
            <LoadingState />
          ) : transactions.isError ? (
            <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
          ) : (
            <EmptyState />
          )
        }
        ListFooterComponent={transactions.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : undefined}
        renderItem={({ item }) => <AdminTransactionRow transaction={item} />}
      />
      {canWrite ? <AddFab onPress={() => router.push('/admin/transactions/new')} /> : null}
    </View>
  );
}

function AdminTransactionRow({ transaction }: { transaction: AdminTransaction }) {
  const income = transaction.type === 'income';
  return (
    <ListRow>
      <List.Item
        title={transaction.description || transaction.categoryName || '—'}
        titleNumberOfLines={2}
        titleStyle={styles.rowTitle}
        description={[formatDate(transaction.date), transaction.categoryName, transaction.accountName, transaction.apartmentLabel]
          .filter(Boolean)
          .join(' · ')}
        descriptionNumberOfLines={2}
        descriptionStyle={styles.muted}
        onPress={transaction.hasReceipt ? () => openReceipt('admin-transaction', transaction.id) : undefined}
        left={(props) => (
          <List.Icon
            {...props}
            color={income ? statusColors.income : statusColors.expense}
            icon={income ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
          />
        )}
        right={() => (
          <View style={styles.right}>
            <AmountText value={transaction.amount} tone={income ? 'income' : 'expense'} />
            {transaction.hasReceipt ? <List.Icon icon="receipt" color={brand.primary} /> : null}
          </View>
        )}
      />
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  filters: { padding: 16, gap: 10 },
  muted: { color: brand.lightText },
  rowTitle: { color: brand.darkText, fontFamily: fontFamilies.medium },
  footer: { margin: 16 },
  right: { alignItems: 'flex-end', justifyContent: 'center' }
});
