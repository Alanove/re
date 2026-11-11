import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import type { AccessRequestDetail, ApproveAccessResult } from '@/api/types';
import { ReadOnlyNotice, useCanWrite } from '@/components/admin';
import { ConfirmDialog, dialogStyle } from '@/components/ConfirmDialog';
import { Alert, Avatar, Button, Card, InfoGrid } from '@/components/ui';
import { brand } from '@/theme';
import { useFeedback } from '@/components/FeedbackProvider';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';
import { emailField, requiredText } from '@/utils/validation';

export default function AccessRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const detail = useQuery({
    queryKey: ['admin', 'access-request', requestId],
    queryFn: () => adminApi.accessRequest(requestId)
  });

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  return <ReviewForm detail={detail.data} />;
}

interface ApartmentChoice {
  selected: boolean;
  role: 'owner' | 'tenant';
  transferPrimary: boolean;
}

function ReviewForm({ detail }: { detail: AccessRequestDetail }) {
  const { t, i18n } = useTranslation();
  const canWrite = useCanWrite();
  const queryClient = useQueryClient();
  const { showMessage } = useFeedback();
  const { request, members, matchingMemberId, suggestedMemberIds } = detail;

  const [linkMode, setLinkMode] = useState<'create' | 'existing'>(matchingMemberId ? 'existing' : 'create');
  const [memberId, setMemberId] = useState<number | null>(matchingMemberId ?? suggestedMemberIds[0] ?? null);
  const [choices, setChoices] = useState<Record<number, ApartmentChoice>>(() =>
    Object.fromEntries(request.apartments.map((a) => [a.id, { selected: true, role: a.role, transferPrimary: false }]))
  );
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [approvedResult, setApprovedResult] = useState<ApproveAccessResult | null>(null);

  const schema = useMemo(
    () => z.object({ fullName: requiredText(), email: emailField(), phone: requiredText() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );
  type FormValues = z.infer<typeof schema>;
  const { control, handleSubmit, getValues, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: request.fullName, email: request.email, phone: request.phone }
  });

  useEffect(() => {
    if (linkMode !== 'existing' || !memberId) return;
    const member = members.find((m) => m.id === memberId);
    if (member?.email) setValue('email', member.email);
  }, [linkMode, memberId, members, setValue]);

  const memberOptions = useMemo(() => {
    const suggested = new Set(suggestedMemberIds);
    return [...members]
      .sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)) || a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name, description: [m.email, m.phone].filter(Boolean).join(' · ') }));
  }, [members, suggestedMemberIds]);

  const finish = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    showMessage(message);
    router.back();
  };

  const approve = useMutation({
    mutationFn: (values: FormValues) => {
      const selected = request.apartments.filter((a) => choices[a.id]?.selected);
      return adminApi.approveAccessRequest(request.id, {
        linkMode,
        userId: linkMode === 'existing' ? memberId : null,
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        apartmentIds: selected.map((a) => a.id),
        apartmentRoles: Object.fromEntries(selected.map((a) => [String(a.id), choices[a.id].role])),
        apartmentActions: Object.fromEntries(
          selected.map((a) => [String(a.id), choices[a.id].transferPrimary ? 'transfer_primary' : 'add_owner'])
        )
      });
    },
    onSuccess: (result) => {
      setConfirm(null);
      if (!result.emailSent && result.tempPassword) {
        setApprovedResult(result);
        return;
      }
      finish(result.message || t('admin.approved'));
    },
    onError: () => setConfirm(null)
  });

  const reject = useMutation({
    mutationFn: () => adminApi.rejectAccessRequest(request.id),
    onSuccess: (result) => {
      setConfirm(null);
      finish(result.message || t('admin.rejected'));
    },
    onError: () => setConfirm(null)
  });

  const submitApprove = handleSubmit(() => {
    setFormError(null);
    if (!request.apartments.some((a) => choices[a.id]?.selected)) {
      setFormError(t('validation.apartments'));
      return;
    }
    if (linkMode === 'existing' && !memberId) {
      setFormError(t('admin.chooseMember'));
      return;
    }
    setConfirm('approve');
  });
  const onApprove = () => void submitApprove();

  const mutationError = approve.error || reject.error;
  const busy = approve.isPending || reject.isPending;

  return (
    <Screen>
      <ReadOnlyNotice />
      <Alert tone="error" visible={Boolean(mutationError || formError)}>
        {formError || (mutationError ? errorMessage(mutationError) : '')}
      </Alert>

      <Card>
        <Card.Title
          title={request.fullName}
          subtitle={t('admin.requestedOn', { date: formatDate(request.createdAt) })}
          left={() => <Avatar name={request.fullName} size={40} />}
        />
        <Card.Content>
          <InfoGrid
            items={[
              { label: t('auth.email'), value: request.email },
              { label: t('auth.phone'), value: request.phone }
            ]}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title={t('admin.linkMode')} />
        <Card.Content style={styles.gap}>
          {matchingMemberId ? <Alert>{t('admin.matchingMember')}</Alert> : null}
          <SegmentedButtons
            value={linkMode}
            onValueChange={(value) => setLinkMode(value as 'create' | 'existing')}
            buttons={[
              { value: 'create', label: t('admin.createMember') },
              { value: 'existing', label: t('admin.linkExisting'), disabled: members.length === 0 }
            ]}
          />
          {linkMode === 'existing' ? (
            <SelectField label={t('admin.chooseMember')} value={memberId} options={memberOptions} onChange={setMemberId} />
          ) : null}
          <FormTextField control={control} name="fullName" label={t('auth.fullName')} />
          <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" keyboardType="email-address" />
          <FormTextField control={control} name="phone" label={t('auth.phone')} keyboardType="phone-pad" />
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title={t('admin.apartmentsToLink')} />
        <Card.Content style={styles.gap}>
          {request.apartments.map((apt) => {
            const choice = choices[apt.id];
            const update = (patch: Partial<ApartmentChoice>) =>
              setChoices((current) => ({ ...current, [apt.id]: { ...current[apt.id], ...patch } }));
            return (
              <View key={apt.id} style={styles.apartment}>
                <Checkbox.Item
                  label={apt.label}
                  status={choice.selected ? 'checked' : 'unchecked'}
                  onPress={() => update({ selected: !choice.selected })}
                  position="leading"
                  labelStyle={styles.left}
                />
                {choice.selected ? (
                  <View style={styles.apartmentOptions}>
                    <SegmentedButtons
                      value={choice.role}
                      onValueChange={(role) => update({ role: role as 'owner' | 'tenant' })}
                      buttons={[
                        { value: 'owner', label: t('common.owner') },
                        { value: 'tenant', label: t('common.tenant') }
                      ]}
                    />
                    {apt.ownerName ? (
                      <Text variant="bodySmall" style={styles.muted}>
                        {t('admin.currentOwner', { name: apt.ownerName })}
                      </Text>
                    ) : null}
                    {choice.role === 'owner' && apt.ownerId ? (
                      <Checkbox.Item
                        label={t('admin.transferPrimary')}
                        status={choice.transferPrimary ? 'checked' : 'unchecked'}
                        onPress={() => update({ transferPrimary: !choice.transferPrimary })}
                        position="leading"
                        labelStyle={styles.left}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card.Content>
      </Card>

      {canWrite ? (
        <View style={styles.actions}>
          <Button mode="contained" tone="danger" icon="close" style={styles.flex} onPress={() => setConfirm('reject')} disabled={busy}>
            {t('admin.reject')}
          </Button>
          <Button mode="contained" icon="check" style={styles.flex} onPress={onApprove} disabled={busy}>
            {t('admin.approve')}
          </Button>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirm === 'approve'}
        title={t('admin.approve')}
        message={t('admin.approveConfirm', { name: getValues('fullName') })}
        confirmLabel={t('admin.approve')}
        loading={approve.isPending}
        onDismiss={() => setConfirm(null)}
        onConfirm={() => approve.mutate(getValues())}
      />
      <ConfirmDialog
        visible={confirm === 'reject'}
        title={t('admin.reject')}
        message={t('admin.rejectConfirm', { name: request.fullName })}
        confirmLabel={t('admin.reject')}
        destructive
        loading={reject.isPending}
        onDismiss={() => setConfirm(null)}
        onConfirm={() => reject.mutate()}
      />

      <Portal>
        <Dialog visible={Boolean(approvedResult)} dismissable={false} style={dialogStyle}>
          <Dialog.Title>{t('admin.tempPasswordTitle')}</Dialog.Title>
          <Dialog.Content style={styles.gap}>
            <Text variant="bodyMedium">{approvedResult?.message}</Text>
            <Text variant="headlineSmall" selectable style={styles.password}>
              {approvedResult?.tempPassword}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button icon="content-copy" onPress={() => void Clipboard.setStringAsync(approvedResult?.tempPassword || '')}>
              {t('common.copy')}
            </Button>
            <Button mode="contained" onPress={() => finish(t('admin.approved'))}>
              {t('common.close')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  flex: { flex: 1 },
  left: { textAlign: 'left' },
  apartment: { gap: 4 },
  apartmentOptions: { gap: 8, paddingLeft: 16, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 12 },
  muted: { color: brand.lightText },
  password: {
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: brand.accent,
    backgroundColor: brand.cream,
    borderColor: brand.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12
  }
});
