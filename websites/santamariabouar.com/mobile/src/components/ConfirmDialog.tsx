import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { brand } from '@/theme';
import { Button } from './ui';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onDismiss
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={dialogStyle}>
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.message}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading} textColor={brand.lightText}>
            {t('common.cancel')}
          </Button>
          <Button
            mode="contained"
            tone={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            disabled={loading}>
            {confirmLabel || t('common.confirm')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** Shared dialog look: white panel with the website's 12px radius. */
export const dialogStyle = { backgroundColor: brand.white, borderRadius: 12 };

const styles = StyleSheet.create({
  title: { color: brand.darkText },
  message: { color: brand.darkText, lineHeight: 21 }
});
