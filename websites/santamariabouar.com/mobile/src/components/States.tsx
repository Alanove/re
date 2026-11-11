import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { brand } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { Button } from './ui';

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={brand.primary} />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name="cloud-alert-outline" size={44} color={brand.lightText} />
      <Text variant="bodyLarge" style={styles.text}>
        {errorMessage(error)}
      </Text>
      {onRetry ? (
        <Button mode="contained" onPress={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </View>
  );
}

/** Website "account-empty" message. */
export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <Text variant="bodyMedium" style={styles.text}>
        {message || t('common.empty')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: brand.cream },
  empty: { padding: 24, alignItems: 'center' },
  text: { textAlign: 'center', color: brand.lightText }
});
