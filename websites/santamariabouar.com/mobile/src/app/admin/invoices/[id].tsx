import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, HelperText, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { AdminInvoiceDetail } from '@/api/types';
import { ReadOnlyNotice, useAccounts, useCanWrite } from '@/components/admin';
import { AmountText } from '@/components/AmountText';
import { ConfirmDialog, dialogStyle } from '@/components/ConfirmDialog';
import { useFeedback } from '@/components/FeedbackProvider';
import { FormTextField } from '@/components/FormTextField';
import { openReceipt } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { ErrorState, LoadingState } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { Button, Card, InfoGrid, TotalDue } from '@/components/ui';
import { brand } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { formatDate, formatMoney, parseAmountInput, plainLabel, todayIso } from '@/utils/format';
import { isoDate, optionalAmount } from '@/utils/validation';

export default function AdminInvoiceDetailScreen() {
  const { t } = useTranslation();
  const canWrite = useCanWrite();
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const [payOpen, setPayOpen] = useState(false);

  const invoice = useQuery({ queryKey: ['admin', 'invoice', invoiceId], queryFn: () => adminApi.invoice(invoiceId) });

  if (invoice.isPending) return <LoadingState />;
  if (invoice.isError) return <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />;

  const data = invoice.data;

  return (
    <Screen refreshing={invoice.isRefetching} onRefresh={() => invoice.refetch()}>
      <ReadOnlyNotice />
      <Card>
        <Card.Title
          title={data.description}
          titleNumberOfLines={3}
          subtitle={data.apartmentLabel}
          right={() => (
            <View style={styles.chip}>
              <StatusChip status={data.status} />
            </View>
          )}
        />
        <Card.Content style={styles.body}>
          <InfoGrid
            items={[
              data.ownerName ? { label: t('common.owner'), value: data.ownerName } : null,
              data.categoryName ? { label: t('common.category'), value: data.categoryName } : null,
              { label: t('admin.invoiceDate'), value: formatDate(data.invoiceDate) },
              data.dueDate ? { label: t('admin.dueDate'), value: formatDate(data.dueDate) } : null,
              data.year ? { label: t('admin.year'), value: String(data.year) } : null,
              data.notes ? { label: t('admin.notes'), value: data.notes } : null
            ]}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={styles.facts}>
          <Row label={t('common.amount')} value={data.amount} />
          <Row label={t('admin.paidSoFar')} value={data.amountPaid} />
          {data.breakdown.walletAmount > 0 ? <Row label={t('member.walletPayment')} value={data.breakdown.walletAmount} muted /> : null}
          <TotalDue
            label={t('member.balance')}
            amount={data.balance}
            note={t('admin.walletAvailable', { amount: formatMoney(data.walletBalance) })}
          />
        </Card.Content>
      </Card>

      {canWrite && data.status !== 'paid' ? (
        <Button mode="contained" icon="cash-check" onPress={() => setPayOpen(true)}>
          {t('admin.payInvoice')}
        </Button>
      ) : null}
      {data.amountPaid > 0 ? (
        <Button mode="contained" tone="secondary" icon="receipt" onPress={() => openReceipt('admin-invoice', data.id)}>
          {t('common.viewReceipt')}
        </Button>
      ) : null}

      {payOpen ? <PayInvoiceDialog invoice={data} onDismiss={() => setPayOpen(false)} /> : null}
    </Screen>
  );
}

function PayInvoiceDialog({ invoice, onDismiss }: { invoice: AdminInvoiceDetail; onDismiss: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { showMessage } = useFeedback();
  const accounts = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const walletDefault = Math.min(invoice.walletBalance, invoice.balance);
  const cashDefault = Math.max(0, Math.round((invoice.balance - walletDefault) * 100) / 100);

  const schema = useMemo(
    () =>
      z
        .object({
          walletAmount: optionalAmount(),
          cashAmount: optionalAmount(),
          accountId: z.number().int().nullable(),
          date: isoDate(),
          description: z.string()
        })
        .superRefine((v, ctx) => {
          const wallet = parseAmountInput(v.walletAmount || '0') || 0;
          const cash = parseAmountInput(v.cashAmount || '0') || 0;
          if (wallet + cash <= 0) ctx.addIssue({ code: 'custom', path: ['cashAmount'], message: t('validation.amount') });
          if (wallet > invoice.walletBalance + 0.001) {
            ctx.addIssue({
              code: 'custom',
              path: ['walletAmount'],
              message: t('admin.walletAvailable', { amount: formatMoney(invoice.walletBalance) })
            });
          }
          if (cash > 0 && !v.accountId) ctx.addIssue({ code: 'custom', path: ['accountId'], message: t('validation.required') });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language, invoice.walletBalance]
  );
  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      walletAmount: walletDefault > 0 ? walletDefault.toFixed(2) : '',
      cashAmount: cashDefault > 0 ? cashDefault.toFixed(2) : '',
      accountId: null,
      date: todayIso(),
      description: ''
    }
  });

  const pay = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.payInvoice(invoice.id, {
        walletAmount: parseAmountInput(values.walletAmount || '0') || 0,
        cashAmount: parseAmountInput(values.cashAmount || '0') || 0,
        accountId: values.accountId,
        date: values.date,
        description: values.description.trim() || undefined
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      showMessage(result.message);
      onDismiss();
    },
    onSettled: () => setConfirmOpen(false)
  });

  const total = () =>
    (parseAmountInput(getValues('walletAmount') || '0') || 0) + (parseAmountInput(getValues('cashAmount') || '0') || 0);

  return (
    <Portal>
      <Dialog visible onDismiss={pay.isPending ? undefined : onDismiss} style={[dialogStyle, styles.dialog]}>
        <Dialog.Title>{t('admin.payInvoice')}</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={styles.dialogContent}>
            <TotalDue label={t('member.balance')} amount={invoice.balance} />
            {invoice.walletBalance > 0 ? (
              <FormTextField
                control={control}
                name="walletAmount"
                label={t('admin.payFromWallet')}
                keyboardType="decimal-pad"
              />
            ) : null}
            <FormTextField control={control} name="cashAmount" label={t('admin.payCash')} keyboardType="decimal-pad" />
            <Controller
              control={control}
              name="accountId"
              render={({ field, fieldState }) => (
                <SelectField
                  label={t('common.account')}
                  value={field.value}
                  options={(accounts.data || []).map((a) => ({ value: a.id, label: a.name }))}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <FormTextField control={control} name="date" label={t('common.date')} autoCapitalize="none" />
            <FormTextField
              control={control}
              name="description"
              label={`${t('common.description')} (${t('common.optional')})`}
            />
            {pay.isError ? <HelperText type="error">{errorMessage(pay.error)}</HelperText> : null}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={pay.isPending}>
            {t('common.cancel')}
          </Button>
          <Button mode="contained" onPress={() => void handleSubmit(() => setConfirmOpen(true))()} disabled={pay.isPending}>
            {t('admin.payInvoice')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <ConfirmDialog
        visible={confirmOpen}
        title={t('admin.payInvoice')}
        message={t('admin.payConfirm', { amount: formatMoney(total()) })}
        loading={pay.isPending}
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={() => pay.mutate(getValues())}
      />
    </Portal>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={muted ? styles.muted : styles.label}>
        {plainLabel(label)}
      </Text>
      <AmountText value={value} variant="bodyMedium" style={muted ? styles.muted : styles.label} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { marginRight: 16 },
  body: { paddingBottom: 16 },
  facts: { gap: 10, paddingVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: brand.darkText },
  muted: { color: brand.lightText },
  dialog: { maxHeight: '90%' },
  dialogContent: { gap: 8, paddingVertical: 12 }
});
