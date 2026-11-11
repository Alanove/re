import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import type { InvoiceStatus } from '@/api/types';
import { fontFamilies, statusPalette } from '@/theme';

/** Website "account-badge--{status}" pill. */
export function StatusChip({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  const palette = statusPalette[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  label: { fontSize: 11, fontFamily: fontFamilies.bold, textTransform: 'uppercase', letterSpacing: 0.4 }
});
