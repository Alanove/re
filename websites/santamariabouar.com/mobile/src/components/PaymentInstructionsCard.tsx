import { Linking, StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import type { PaymentInstructions } from '@/api/types';
import { brand } from '@/theme';
import { stripHtml } from '@/utils/format';
import { Button, Card } from './ui';

export function PaymentInstructionsCard({ instructions }: { instructions: PaymentInstructions }) {
  const { t } = useTranslation();
  const settings = instructions.settings;
  const methods = [
    settings?.whishEnabled ? { title: 'Whish', details: settings.whishDetails } : null,
    settings?.omtEnabled ? { title: 'OMT', details: settings.omtDetails } : null,
    settings?.bankTransferEnabled ? { title: 'Bank transfer', details: settings.bankInfo } : null
  ].filter((m): m is { title: string; details: string } => Boolean(m));

  return (
    <Card>
      <Card.Title title={t('member.howToPay')} />
      <Card.Content style={styles.content}>
        {methods.map((method) => (
          <View key={method.title} style={styles.method}>
            <Text variant="titleSmall" style={styles.dark}>
              {method.title}
            </Text>
            <Text variant="bodyMedium" selectable style={styles.dark}>
              {stripHtml(method.details)}
            </Text>
          </View>
        ))}
        {instructions.coordinatorName || instructions.coordinatorPhone ? (
          <>
            {methods.length > 0 ? <Divider style={styles.divider} /> : null}
            <Text variant="titleSmall" style={styles.dark}>
              {t('member.coordinator')}
            </Text>
            <View style={styles.coordinator}>
              <Text variant="bodyMedium" style={[styles.flex, styles.dark]}>
                {[instructions.coordinatorName, instructions.coordinatorPhone].filter(Boolean).join(' · ')}
              </Text>
              {instructions.coordinatorPhone ? (
                <Button
                  icon="phone"
                  mode="contained"
                  compact
                  onPress={() => Linking.openURL(`tel:${instructions.coordinatorPhone.replace(/[^\d+]/g, '')}`)}>
                  {t('member.call')}
                </Button>
              ) : null}
            </View>
          </>
        ) : null}
        {instructions.yearlyInterestRate > 0 ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="bodySmall" style={styles.dark}>
              {t('member.interestNote', { rate: instructions.yearlyInterestRate })}
            </Text>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  method: { gap: 2 },
  coordinator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dark: { color: brand.darkText },
  divider: { backgroundColor: brand.border }
});
