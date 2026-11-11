import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, HelperText, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { WalletDetail } from '@/api/types';
import { ReadOnlyNotice, useAccounts, useCanWrite } from '@/components/admin';
import { ConfirmDialog, dialogStyle } from '@/components/ConfirmDialog';
import { Button, Card, Eyebrow, StatTile } from '@/components/ui';
import { brand, fontFamilies, statusColors } from '@/theme';
import { useFeedback } from '@/components/FeedbackProvider';
import { FormTextField } from '@/components/FormTextField';
import { WalletEntryRow } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/utils/errors';
import { formatMoney, parseAmountInput, todayIso } from '@/utils/format';
import { isoDate, positiveAmount, requiredText } from '@/utils/validation';

type EntryKind = 'add' | 'subtract';

export default function AdminWalletDetailScreen() {
  const { t } = useTranslation();
  const canWrite = useCanWrite();
  const { apartmentId } = useLocalSearchParams<{ apartmentId: string }>();
  const id = Number(apartmentId);
  const [dialog, setDialog] = useState<EntryKind | null>(null);

  const wallet = useQuery({ queryKey: ['admin', 'wallet', id], queryFn: () => adminApi.wallet(id) });

  if (wallet.isPending) return <LoadingState />;
  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={() => wallet.refetch()} />;

  const data = wallet.data;

  return (
    <Screen refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()}>
      <Stack.Screen options={{ title: data.label }} />
      <ReadOnlyNotice />

      <Card>
        <Card.Content style={styles.summary}>
          <Eyebrow>{t('member.walletBalance')}</Eyebrow>
          <Text variant="displaySmall" style={styles.balance}>
            {formatMoney(data.balance)}
          </Text>
          {data.ownerName ? (
            <Text variant="bodyMedium" style={styles.muted}>
              {data.ownerName}
            </Text>
          ) : null}
          <View style={styles.totals}>
            <StatTile
              style={styles.flex}
              label={t('admin.totalAdded')}
              value={formatMoney(data.totalAdded)}
              valueColor={statusColors.income}
            />
            <StatTile
              style={styles.flex}
              label={t('admin.totalSubtracted')}
              value={formatMoney(data.totalSubtracted)}
              valueColor={statusColors.expense}
            />
          </View>
        </Card.Content>
      </Card>

      {canWrite ? (
        <View style={styles.actions}>
          <Button mode="contained" icon="plus" style={styles.flex} onPress={() => setDialog('add')}>
            {t('admin.addFunds')}
          </Button>
          <Button
            mode="contained"
            tone="secondary"
            icon="minus"
            style={styles.flex}
            disabled={data.balance <= 0}
            onPress={() => setDialog('subtract')}>
            {t('admin.subtractFunds')}
          </Button>
        </View>
      ) : null}

      <Card>
        <Card.Title title={t('member.walletEntries')} />
        {data.entries.length === 0 ? <EmptyState /> : data.entries.map((entry) => <WalletEntryRow key={entry.id} entry={entry} />)}
      </Card>

      {dialog ? <WalletEntryDialog wallet={data} kind={dialog} onDismiss={() => setDialog(null)} /> : null}
    </Screen>
  );
}

function WalletEntryDialog({ wallet, kind, onDismiss }: { wallet: WalletDetail; kind: EntryKind; onDismiss: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { showMessage } = useFeedback();
  const accounts = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          amount: positiveAmount(),
          accountId: z.number().int().positive(t('validation.required')),
          date: isoDate(),
          description: kind === 'subtract' ? requiredText() : z.string()
        })
        .refine((v) => kind === 'add' || parseAmountInput(v.amount) <= wallet.balance + 0.001, {
          path: ['amount'],
          message: t('admin.walletAvailable', { amount: formatMoney(wallet.balance) })
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language, kind, wallet.balance]
  );
  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', accountId: 0, date: todayIso(), description: '' }
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.walletEntry(wallet.apartmentId, kind, {
        amount: parseAmountInput(values.amount),
        accountId: values.accountId,
        date: values.date,
        description: values.description.trim()
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      showMessage(result.message);
      onDismiss();
    },
    onSettled: () => setConfirmOpen(false)
  });

  const title = kind === 'add' ? t('admin.addFunds') : t('admin.subtractFunds');
  const amountLabel = formatMoney(parseAmountInput(getValues('amount') || '0') || 0);

  return (
    <Portal>
      <Dialog visible onDismiss={save.isPending ? undefined : onDismiss} style={dialogStyle}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <FormTextField control={control} name="amount" label={t('common.amount')} keyboardType="decimal-pad" />
          <Controller
            control={control}
            name="accountId"
            render={({ field, fieldState }) => (
              <SelectField
                label={t('common.account')}
                value={field.value || null}
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
            label={kind === 'subtract' ? t('common.description') : `${t('common.description')} (${t('common.optional')})`}
          />
          {save.isError ? <HelperText type="error">{errorMessage(save.error)}</HelperText> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button mode="contained" onPress={() => void handleSubmit(() => setConfirmOpen(true))()} disabled={save.isPending}>
            {title}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <ConfirmDialog
        visible={confirmOpen}
        title={title}
        message={
          kind === 'add'
            ? t('admin.addConfirm', { amount: amountLabel })
            : t('admin.subtractConfirm', { amount: amountLabel })
        }
        destructive={kind === 'subtract'}
        loading={save.isPending}
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={() => save.mutate(getValues())}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { gap: 4, paddingVertical: 16 },
  balance: { color: brand.accent, fontFamily: fontFamilies.bold },
  muted: { color: brand.lightText },
  totals: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 12 },
  dialogContent: { gap: 8 }
});
