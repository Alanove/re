import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Constants from 'expo-constants';
import { Dialog, HelperText, List, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { deviceName, useAuth } from '@/auth/AuthProvider';
import { brand, fontFamilies } from '@/theme';
import { ConfirmDialog, dialogStyle } from './ConfirmDialog';
import { Avatar, Button, Card, Pill } from './ui';
import { useFeedback } from './FeedbackProvider';
import { FormTextField } from './FormTextField';
import { Screen } from './Screen';
import { LINKS } from '@/config';
import { setLanguage, type Language } from '@/i18n';
import { errorMessage } from '@/utils/errors';
import { requiredText } from '@/utils/validation';

export function ProfileContent() {
  const { t, i18n } = useTranslation();
  const { user, mode, setMode, signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  return (
    <Screen>
      <Card>
        <Card.Content style={styles.identity}>
          <Avatar name={user.name} size={64} />
          <Text variant="titleMedium" style={styles.name}>
            {user.name}
          </Text>
          <Pill style={styles.centered}>{user.role}</Pill>
          {user.email ? (
            <Text variant="bodyMedium" style={styles.muted}>
              {user.email}
            </Text>
          ) : null}
          {user.phone ? (
            <Text variant="bodyMedium" style={styles.muted}>
              {user.phone}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {user.isAdmin ? (
        <Button
          mode="contained"
          tone="secondary"
          icon={mode === 'admin' ? 'home-city-outline' : 'shield-account-outline'}
          onPress={() => setMode(mode === 'admin' ? 'member' : 'admin')}>
          {mode === 'admin' ? t('admin.switchToMember') : t('member.switchToAdmin')}
        </Button>
      ) : null}

      <Card>
        <Card.Title title={t('member.language')} />
        <Card.Content style={styles.body}>
          <SegmentedButtons            value={i18n.language === 'fr' ? 'fr' : 'en'}
            onValueChange={(value) => void setLanguage(value as Language)}
            buttons={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' }
            ]}
          />
        </Card.Content>
      </Card>

      <Card>
        <MenuItem icon="lock-reset" title={t('member.changePassword')} onPress={() => setPasswordOpen(true)} />
        <MenuItem icon="shield-lock-outline" title={t('auth.viewPrivacy')} onPress={() => Linking.openURL(LINKS.privacyPolicy)} />
        <MenuItem icon="file-document-outline" title={t('auth.viewTerms')} onPress={() => Linking.openURL(LINKS.terms)} />
        <MenuItem icon="account-remove-outline" title={t('member.deleteAccount')} onPress={() => setDeleteOpen(true)} danger />
      </Card>

      <Button mode="outlined" tone="danger" icon="logout" onPress={() => setSignOutOpen(true)}>
        {t('common.signOut')}
      </Button>

      <Text variant="bodySmall" style={styles.version}>
        {t('common.appName')} v{Constants.expoConfig?.version || '1.0.0'}
      </Text>

      <ChangePasswordDialog visible={passwordOpen} onDismiss={() => setPasswordOpen(false)} />

      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => setDeleteOpen(false)} style={dialogStyle}>
          <Dialog.Title>{t('member.deleteAccount')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('member.deleteAccountHelp')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)}>{t('common.close')}</Button>
            <Button
              mode="contained"
              tone="danger"
              onPress={() => {
                setDeleteOpen(false);
                void Linking.openURL(LINKS.contact);
              }}>
              {t('member.deleteAccount')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ConfirmDialog
        visible={signOutOpen}
        title={t('common.signOut')}
        message={t('member.signOutConfirm')}
        confirmLabel={t('common.signOut')}
        loading={signingOut}
        onDismiss={() => setSignOutOpen(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
    </Screen>
  );
}

function ChangePasswordDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { t, i18n } = useTranslation();
  const { applyTokens } = useAuth();
  const { showMessage } = useFeedback();
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: requiredText(),
          newPassword: z.string().min(8, t('validation.passwordLength')),
          confirmPassword: z.string()
        })
        .refine((v) => v.newPassword === v.confirmPassword, {
          message: t('validation.passwordMatch'),
          path: ['confirmPassword']
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );
  const { control, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  const close = () => {
    reset();
    setError(null);
    onDismiss();
  };

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await memberApi.changePassword(values.currentPassword, values.newPassword, deviceName());
      if (result.tokens) await applyTokens(result.tokens);
      showMessage(t('member.passwordUpdated'));
      close();
    } catch (err) {
      setError(errorMessage(err));
    }
  });
  const onSubmit = () => void submit();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={formState.isSubmitting ? undefined : close} style={dialogStyle}>
        <Dialog.Title>{t('member.changePassword')}</Dialog.Title>
        <Dialog.Content>
          <View style={styles.gap}>
            <FormTextField control={control} name="currentPassword" label={t('member.currentPassword')} secureTextEntry />
            <FormTextField control={control} name="newPassword" label={t('member.newPassword')} secureTextEntry />
            <FormTextField control={control} name="confirmPassword" label={t('member.confirmPassword')} secureTextEntry />
            {error ? <HelperText type="error">{error}</HelperText> : null}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={close} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button mode="contained" onPress={onSubmit} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
            {t('common.save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function MenuItem({ icon, title, onPress, danger }: { icon: string; title: string; onPress: () => void; danger?: boolean }) {
  const color = danger ? brand.danger : brand.darkText;
  return (
    <List.Item
      title={title}
      titleStyle={{ color, fontFamily: fontFamilies.medium }}
      left={(props) => <List.Icon {...props} color={danger ? brand.danger : brand.primary} icon={icon} />}
      right={(props) => <List.Icon {...props} color={brand.lightText} icon="chevron-right" />}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  body: { paddingBottom: 16 },
  identity: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  name: { color: brand.darkText, fontFamily: fontFamilies.bold, marginTop: 4 },
  centered: { alignSelf: 'center' },
  muted: { color: brand.lightText },
  version: { textAlign: 'center', color: brand.lightText }
});
