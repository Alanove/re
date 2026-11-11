import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HelperText, SegmentedButtons } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { ApartmentOption } from '@/api/types';
import { ReadOnlyNotice, searchApartments, useAccounts, useCanWrite, useCategories } from '@/components/admin';
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
import { isoDate, positiveAmount, requiredText } from '@/utils/validation';

export default function NewTransactionScreen() {
  const { t, i18n } = useTranslation();
  const canWrite = useCanWrite();
  const queryClient = useQueryClient();
  const { showMessage } = useFeedback();
  const accounts = useAccounts();
  const categories = useCategories();
  const [apartment, setApartment] = useState<ApartmentOption | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        categoryId: z.number({ message: t('validation.required') }).int().positive(t('validation.required')),
        accountId: z.number({ message: t('validation.required') }).int().positive(t('validation.required')),
        toAccountId: z.number().int().nullable(),
        type: z.enum(['income', 'expense']),
        amount: positiveAmount(),
        date: isoDate(),
        description: requiredText()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );
  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, setError, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: 0, accountId: 0, toAccountId: null, type: 'income', amount: '', date: todayIso(), description: '' }
  });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const category = categories.data?.find((c) => c.id === categoryId);
  const isTransfer = category?.name.toLowerCase() === 'transfer';

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.createTransaction({
        categoryId: values.categoryId,
        accountId: values.accountId,
        toAccountId: isTransfer ? values.toAccountId ?? undefined : undefined,
        amount: parseAmountInput(values.amount),
        date: values.date,
        description: values.description.trim(),
        type: category?.type === 'both' ? values.type : undefined,
        apartmentId: isTransfer ? null : apartment?.id ?? null
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      showMessage(t('admin.transactionCreated'));
      router.back();
    },
    onSettled: () => setConfirmOpen(false)
  });

  if (accounts.isPending || categories.isPending) return <LoadingState />;
  if (accounts.isError) return <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />;
  if (categories.isError) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;
  if (!canWrite) {
    return (
      <Screen>
        <ReadOnlyNotice />
      </Screen>
    );
  }

  const accountOptions = accounts.data.map((a) => ({ value: a.id, label: a.name, description: formatMoney(a.balance) }));
  const categoryOptions = categories.data
    .filter((c) => c.supportedOnMobile)
    .map((c) => ({ value: c.id, label: c.name }));

  const submit = handleSubmit((values) => {
    if (isTransfer && (!values.toAccountId || values.toAccountId === values.accountId)) {
      setError('toAccountId', { message: t('validation.required') });
      return;
    }
    setConfirmOpen(true);
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <Alert>{t('admin.commonExpenseHint')}</Alert>
      <Alert tone="error" visible={create.isError}>
        {create.isError ? errorMessage(create.error) : ''}
      </Alert>

      <Card>
      <Card.Content style={styles.form}>
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

      {category?.type === 'both' && !isTransfer ? (
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'income', label: t('admin.incomeType') },
                { value: 'expense', label: t('admin.expenseType') }
              ]}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="accountId"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('common.account')}
            value={field.value || null}
            options={accountOptions}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      {isTransfer ? (
        <Controller
          control={control}
          name="toAccountId"
          render={({ field, fieldState }) => (
            <SelectField
              label={t('admin.toAccount')}
              value={field.value}
              options={accountOptions}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : (
        <ApartmentPicker
          label={`${t('common.apartment')} (${t('common.optional')})`}
          value={apartment}
          onChange={setApartment}
          search={searchApartments}
          allowClear
        />
      )}

      <FormTextField control={control} name="amount" label={t('common.amount')} keyboardType="decimal-pad" />
      <FormTextField control={control} name="date" label={t('common.date')} autoCapitalize="none" />
      <FormTextField control={control} name="description" label={t('common.description')} multiline />

      {formState.isSubmitted && !formState.isValid ? <HelperText type="error">{t('validation.required')}</HelperText> : null}

      <Button mode="contained" icon="content-save-outline" onPress={onSubmit} disabled={create.isPending}>
        {t('common.save')}
      </Button>
      </Card.Content>
      </Card>

      <ConfirmDialog
        visible={confirmOpen}
        title={t('admin.newTransaction')}
        message={`${category?.name || ''} · ${formatMoney(parseAmountInput(getValues('amount') || '0'))}\n${getValues('description')}`}
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
