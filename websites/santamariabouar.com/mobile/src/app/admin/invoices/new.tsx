import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { ApartmentOption } from '@/api/types';
import { ReadOnlyNotice, searchApartments, useCanWrite, useCategories } from '@/components/admin';
import { ApartmentPicker } from '@/components/ApartmentPicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFeedback } from '@/components/FeedbackProvider';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { ErrorState, LoadingState } from '@/components/States';
import { Alert, Button, Card } from '@/components/ui';
import { errorMessage } from '@/utils/errors';
import { formatMoney, parseAmountInput, todayIso } from '@/utils/format';
import { isoDate, optionalIsoDate, positiveAmount, requiredText } from '@/utils/validation';

export default function NewInvoiceScreen() {
  const { t, i18n } = useTranslation();
  const canWrite = useCanWrite();
  const queryClient = useQueryClient();
  const { showMessage } = useFeedback();
  const categories = useCategories();
  const [apartment, setApartment] = useState<ApartmentOption | null>(null);
  const [apartmentError, setApartmentError] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        categoryId: z.number().int().positive(t('validation.required')),
        amount: positiveAmount(),
        description: requiredText(),
        invoiceDate: isoDate(),
        dueDate: optionalIsoDate(),
        year: z.string().trim().regex(/^(\d{4})?$/, t('validation.required')),
        notes: z.string()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );
  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: 0,
      amount: '',
      description: '',
      invoiceDate: todayIso(),
      dueDate: '',
      year: String(new Date().getFullYear()),
      notes: ''
    }
  });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.createInvoice({
        apartmentId: apartment!.id,
        categoryId: values.categoryId,
        amount: parseAmountInput(values.amount),
        description: values.description.trim(),
        invoiceDate: values.invoiceDate,
        dueDate: values.dueDate || null,
        year: values.year ? Number(values.year) : null,
        notes: values.notes.trim() || null
      }),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      showMessage(t('admin.invoiceCreated'));
      router.replace({ pathname: '/admin/invoices/[id]', params: { id: String(invoice.id) } });
    },
    onSettled: () => setConfirmOpen(false)
  });

  if (categories.isPending) return <LoadingState />;
  if (categories.isError) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;
  if (!canWrite) {
    return (
      <Screen>
        <ReadOnlyNotice />
      </Screen>
    );
  }

  const categoryOptions = categories.data
    .filter((c) => c.type !== 'expense' && c.name.toLowerCase() !== 'transfer')
    .map((c) => ({ value: c.id, label: c.name }));

  const submit = handleSubmit(
    () => {
      if (!apartment) {
        setApartmentError(t('validation.required'));
        return;
      }
      setConfirmOpen(true);
    },
    () => {
      if (!apartment) setApartmentError(t('validation.required'));
    }
  );
  const onSubmit = () => void submit();

  return (
    <Screen>
      <Alert tone="error" visible={create.isError}>
        {create.isError ? errorMessage(create.error) : ''}
      </Alert>

      <Card>
      <Card.Content style={styles.form}>
      <ApartmentPicker
        value={apartment}
        onChange={(value) => {
          setApartment(value);
          setApartmentError(undefined);
        }}
        search={searchApartments}
        error={apartmentError}
      />
      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('common.category')}
            value={field.value || null}
            options={categoryOptions}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <FormTextField control={control} name="amount" label={t('common.amount')} keyboardType="decimal-pad" />
      <FormTextField control={control} name="description" label={t('common.description')} />
      <FormTextField control={control} name="invoiceDate" label={t('admin.invoiceDate')} autoCapitalize="none" />
      <FormTextField
        control={control}
        name="dueDate"
        label={`${t('admin.dueDate')} (${t('common.optional')})`}
        autoCapitalize="none"
      />
      <FormTextField control={control} name="year" label={t('admin.year')} keyboardType="number-pad" maxLength={4} />
      <FormTextField
        control={control}
        name="notes"
        label={`${t('admin.notes')} (${t('common.optional')})`}
        multiline
      />
      {apartmentError ? <HelperText type="error">{apartmentError}</HelperText> : null}

      <Button mode="contained" icon="content-save-outline" onPress={onSubmit} disabled={create.isPending}>
        {t('common.save')}
      </Button>
      </Card.Content>
      </Card>

      <ConfirmDialog
        visible={confirmOpen}
        title={t('admin.newInvoice')}
        message={`${apartment?.label || ''} · ${formatMoney(parseAmountInput(getValues('amount') || '0'))}\n${getValues('description')}`}
        loading={create.isPending}
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={() => create.mutate(getValues())}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, paddingVertical: 16 }
});
