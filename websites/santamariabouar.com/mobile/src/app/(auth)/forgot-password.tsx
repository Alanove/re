import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/api/endpoints';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card } from '@/components/ui';
import { brand } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { emailField } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schema = useMemo(() => z.object({ email: emailField() }), [i18n.language]);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' }
  });

  const submit = handleSubmit(async ({ email }) => {
    setResult(null);
    try {
      const response = await authApi.forgotPassword(email.trim());
      setResult({ ok: true, message: response.message });
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) });
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <Card>
        <Card.Content style={styles.form}>
          <Text variant="headlineSmall" style={styles.heading}>
            {t('auth.forgotTitle')}
          </Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {t('auth.forgotHelp')}
          </Text>
          <Alert tone={result?.ok ? 'success' : 'error'} visible={Boolean(result)}>
            {result?.message}
          </Alert>
          <FormTextField
            control={control}
            name="email"
            label={t('auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            onSubmitEditing={onSubmit}
          />
          <Button mode="contained" onPress={onSubmit} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
            {t('auth.sendLink')}
          </Button>
          <Button onPress={() => router.back()}>{t('auth.backToLogin')}</Button>
        </Card.Content>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingVertical: 20 },
  heading: { color: brand.darkText },
  muted: { color: brand.lightText }
});
