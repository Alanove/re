import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SegmentedButtons } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { InvoiceRow, openReceipt } from '@/components/Rows';
import { Card, TotalDue } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function MemberInvoicesScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'unpaid' | 'all'>('unpaid');
  const invoices = useQuery({ queryKey: ['member', 'invoices', status], queryFn: () => memberApi.invoices(status) });

  const totalDue = (invoices.data || []).reduce((sum, invoice) => sum + (invoice.status === 'paid' ? 0 : invoice.balance), 0);

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      <SegmentedButtons
        value={status}
        onValueChange={(value) => setStatus(value as 'unpaid' | 'all')}
        buttons={[
          { value: 'unpaid', label: t('member.invoicesDue') },
          { value: 'all', label: t('member.invoicesAll') }
        ]}
      />
      {invoices.isPending ? <LoadingState /> : null}
      {invoices.isError ? <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} /> : null}
      {invoices.data ? (
        <>
          <TotalDue label={t('member.totalDue')} amount={totalDue} />
          {invoices.data.length === 0 ? (
            <EmptyState message={status === 'unpaid' ? t('member.allPaid') : undefined} />
          ) : (
            <Card>
              {invoices.data.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onPress={invoice.amountPaid > 0 ? () => openReceipt('invoice', invoice.id) : undefined}
                />
              ))}
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}