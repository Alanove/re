import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card } from '@/components/ui';
import { brand } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { requiredText } from '@/utils/validation';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, sessionExpired } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schema = useMemo(() => z.object({ login: requiredText(), password: requiredText() }), [i18n.language]);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { login: '', password: '' }
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.login.trim(), values.password);
    } catch (err) {
      setError(errorMessage(err));
    }
  });
  const onSubmit = () => void submit();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text variant="titleMedium" style={styles.brandName}>
            {t('common.appName')}
          </Text>
        </View>

        <Card>
          <Card.Content style={styles.form}>
            <Text variant="headlineMedium" style={styles.heading}>
              {t('auth.title')}
            </Text>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('auth.subtitle')}
            </Text>

            <Alert tone="info" visible={sessionExpired && !error}>
              {t('auth.sessionExpired')}
            </Alert>
            <Alert tone="error" visible={Boolean(error)}>
              {error}
            </Alert>

            <FormTextField
              control={control}
              name="login"
              label={t('auth.login')}
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="email-address"
              textContentType="username"
            />
            <FormTextField
              control={control}
              name="password"
              label={t('auth.password')}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  color={brand.lightText}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
              onSubmitEditing={onSubmit}
            />

            <Link href="/forgot-password" asChild>
              <Button compact style={styles.forgot}>
                {t('auth.forgotPassword')}
              </Button>
            </Link>

            <Button mode="contained" onPress={onSubmit} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
              {t('auth.signIn')}
            </Button>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text variant="bodySmall" style={styles.muted}>
                {t('auth.noAccess')}
              </Text>
              <View style={styles.line} />
            </View>

            <Link href="/request-access" asChild>
              <Button mode="contained" tone="secondary">
                {t('auth.requestAccessButton')}
              </Button>
            </Link>
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={styles.footer}>
          {t('auth.footer')}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.cream },
  brandRow: { alignItems: 'center', gap: 8, marginTop: 56, marginBottom: 8 },
  logo: { width: 120, height: 78 },
  brandName: { color: brand.darkText },
  form: { gap: 14, paddingVertical: 20 },
  heading: { color: brand.darkText },
  muted: { color: brand.lightText },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: brand.border },
  footer: { textAlign: 'center', color: brand.lightText }
});
