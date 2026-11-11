import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { useTranslation } from 'react-i18next';

import { memberApi } from '@/api/endpoints';
import { TransactionRow } from '@/components/Rows';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function MemberTransactionsScreen() {
  const { t } = useTranslation();
  const transactions = useQuery({ queryKey: ['member', 'transactions'], queryFn: memberApi.transactions });

  if (transactions.isPending) return <LoadingState />;
  if (transactions.isError) return <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />;

  return (
    <Screen refreshing={transactions.isRefetching} onRefresh={() => transactions.refetch()}>
      {transactions.data.length === 0 ? (
        <EmptyState message={t('member.noPayments')} />
      ) : (
        <Card mode="outlined">
          {transactions.data.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
