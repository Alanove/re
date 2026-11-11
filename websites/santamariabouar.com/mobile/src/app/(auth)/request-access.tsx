import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox, HelperText, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/api/endpoints';
import type { ApartmentOption } from '@/api/types';
import { ApartmentPicker } from '@/components/ApartmentPicker';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card } from '@/components/ui';
import { brand } from '@/theme';
import { LINKS } from '@/config';
import { errorMessage } from '@/utils/errors';
import { emailField, requiredText } from '@/utils/validation';

interface ApartmentRow {
  key: number;
  apartment: ApartmentOption | null;
  role: 'owner' | 'tenant';
}

let rowKey = 0;
const newRow = (): ApartmentRow => ({ key: ++rowKey, apartment: null, role: 'owner' });

export default function RequestAccessScreen() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<ApartmentRow[]>([newRow()]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [extraErrors, setExtraErrors] = useState<{ apartments?: string; terms?: string }>({});
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const directory = useQuery({ queryKey: ['apartment-directory'], queryFn: authApi.apartmentDirectory });

  const schema = useMemo(
    () => z.object({ fullName: requiredText(), email: emailField(), phone: requiredText() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', phone: '' }
  });

  const updateRow = (key: number, patch: Partial<ApartmentRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = handleSubmit(async (values) => {
    const selected = rows.filter((row) => row.apartment);
    const errors: typeof extraErrors = {};
    if (selected.length === 0) errors.apartments = t('validation.apartments');
    if (!acceptTerms) errors.terms = t('validation.terms');
    setExtraErrors(errors);
    if (errors.apartments || errors.terms) return;

    setResult(null);
    try {
      const response = await authApi.requestAccess({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        acceptTerms: true,
        apartments: selected.map((row) => ({ apartmentId: row.apartment!.id, role: row.role }))
      });
      setResult({ ok: true, message: response.message });
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) });
    }
  });
  const onSubmit = () => void submit();

  if (result?.ok) {
    return (
      <Screen>
        <Alert tone="success">{result.message}</Alert>
        <Button mode="contained" onPress={() => router.back()}>
          {t('auth.backToLogin')}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="headlineSmall" style={styles.heading}>
        {t('auth.requestTitle')}
      </Text>
      <Text variant="bodyMedium" style={styles.muted}>
        {t('auth.requestHelp')}
      </Text>
      <Alert tone="error" visible={Boolean(result && !result.ok)}>
        {result?.message}
      </Alert>

      <FormTextField control={control} name="fullName" label={t('auth.fullName')} autoComplete="name" />
      <FormTextField
        control={control}
        name="email"
        label={t('auth.email')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <FormTextField control={control} name="phone" label={t('auth.phone')} keyboardType="phone-pad" autoComplete="tel" />

      <Text variant="titleMedium" style={styles.heading}>
        {t('auth.apartments')}
      </Text>
      {rows.map((row) => (
        <Card key={row.key}>
          <Card.Content style={styles.rowContent}>
            <View style={styles.rowHeader}>
              <View style={styles.flex}>
                <ApartmentPicker
                  value={row.apartment}
                  options={directory.data || []}
                  onChange={(apartment) => updateRow(row.key, { apartment })}
                />
              </View>
              {rows.length > 1 ? (
                <IconButton icon="delete-outline" onPress={() => setRows((r) => r.filter((x) => x.key !== row.key))} />
              ) : null}
            </View>
            <SegmentedButtons
              value={row.role}
              onValueChange={(role) => updateRow(row.key, { role: role as ApartmentRow['role'] })}
              buttons={[
                { value: 'owner', label: t('common.owner') },
                { value: 'tenant', label: t('common.tenant') }
              ]}
            />
          </Card.Content>
        </Card>
      ))}
      {extraErrors.apartments ? <HelperText type="error">{extraErrors.apartments}</HelperText> : null}
      <Button icon="plus" onPress={() => setRows((r) => [...r, newRow()])}>
        {t('auth.addApartment')}
      </Button>

      <Checkbox.Item
        label={t('auth.acceptTerms')}
        status={acceptTerms ? 'checked' : 'unchecked'}
        onPress={() => setAcceptTerms((v) => !v)}
        position="leading"
        labelStyle={styles.checkboxLabel}
      />
      <View style={styles.links}>
        <Button compact onPress={() => Linking.openURL(LINKS.privacyPolicy)}>
          {t('auth.viewPrivacy')}
        </Button>
        <Button compact onPress={() => Linking.openURL(LINKS.terms)}>
          {t('auth.viewTerms')}
        </Button>
      </View>
      {extraErrors.terms ? <HelperText type="error">{extraErrors.terms}</HelperText> : null}

      <Button mode="contained" onPress={onSubmit} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
        {t('common.submit')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowContent: { gap: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  links: { flexDirection: 'row', justifyContent: 'center' },
  checkboxLabel: { textAlign: 'left', color: brand.darkText },
  heading: { color: brand.darkText },
  muted: { color: brand.lightText }
});
