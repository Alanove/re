import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { List } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Avatar, Card } from '@/components/ui';
import { brand, fontFamilies } from '@/theme';
import { formatDate } from '@/utils/format';

export default function AccessRequestsScreen() {
  const { t } = useTranslation();
  const requests = useQuery({ queryKey: ['admin', 'access-requests'], queryFn: adminApi.accessRequests });

  if (requests.isPending) return <LoadingState />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => requests.refetch()} />;

  return (
    <Screen refreshing={requests.isRefetching} onRefresh={() => requests.refetch()}>
      {requests.data.length === 0 ? (
        <EmptyState message={t('admin.noRequests')} />
      ) : (
        <Card>
          {requests.data.map((request) => (
            <List.Item
              key={request.id}
              title={request.fullName}
              titleStyle={styles.title}
              description={[
                request.apartments.map((a) => `${a.label} (${t(`common.${a.role}`)})`).join(', '),
                t('admin.requestedOn', { date: formatDate(request.createdAt) })
              ].join('\n')}
              descriptionNumberOfLines={3}
              descriptionStyle={styles.muted}
              left={() => (
                <View style={styles.avatar}>
                  <Avatar name={request.fullName} size={40} />
                </View>
              )}
              right={(props) => <List.Icon {...props} color={brand.lightText} icon="chevron-right" />}
              onPress={() =>
                router.push({ pathname: '/admin/access-requests/[id]', params: { id: String(request.id) } })
              }
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: brand.darkText, fontFamily: fontFamilies.medium },
  muted: { color: brand.lightText },
  avatar: { justifyContent: 'center', paddingLeft: 8 }
});
