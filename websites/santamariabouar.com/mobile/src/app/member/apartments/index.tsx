import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Card, Pill } from '@/components/ui';
import { SITE_URL } from '@/config';
import { brand, fontFamilies } from '@/theme';

export default function ApartmentsScreen() {
  const { t } = useTranslation();
  const apartments = useQuery({ queryKey: ['member', 'apartments'], queryFn: memberApi.apartments });

  if (apartments.isPending) return <LoadingState />;
  if (apartments.isError) return <ErrorState error={apartments.error} onRetry={() => apartments.refetch()} />;

  return (
    <Screen refreshing={apartments.isRefetching} onRefresh={() => apartments.refetch()}>
      {apartments.data.length === 0 ? <EmptyState message={t('member.noApartments')} /> : null}
      {apartments.data.map((apt) => (
        <Card
          key={apt.id}
          style={styles.card}
          onPress={() => router.push({ pathname: '/member/apartments/[id]', params: { id: String(apt.id) } })}>
          {apt.officialImage ? (
            <Card.Cover source={{ uri: `${SITE_URL}${apt.officialImage}` }} style={styles.cover} />
          ) : (
            <View style={styles.placeholder}>
              <MaterialCommunityIcons name="home-city-outline" size={40} color={brand.lightText} />
            </View>
          )}
          <Card.Content style={styles.body}>
            <Text variant="titleMedium" style={styles.title}>
              {apt.label}
            </Text>
            {apt.areaInM2 ? (
              <Text variant="bodySmall" style={styles.muted}>
                {apt.areaInM2} m²
              </Text>
            ) : null}
            <View style={styles.chips}>
              <Pill>{apt.isPrimaryOwner ? t('common.primaryOwner') : t(`common.${apt.memberRole}`)}</Pill>
              {apt.status ? <Pill>{apt.status}</Pill> : null}
            </View>
            {apt.ownerName && !apt.isPrimaryOwner ? (
              <Text variant="bodySmall" style={styles.muted}>
                {t('common.owner')}: {apt.ownerName}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cover: { height: 160, borderRadius: 0 },
  placeholder: { height: 120, backgroundColor: brand.cream, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 4, paddingVertical: 14 },
  title: { color: brand.darkText, fontFamily: fontFamilies.bold },
  muted: { color: brand.lightText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }
});
