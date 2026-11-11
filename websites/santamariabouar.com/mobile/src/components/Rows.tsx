import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import type { MemberInvoice, MemberTransaction, WalletEntryView } from '@/api/types';
import { AmountText } from './AmountText';
import { StatusChip } from './StatusChip';
import { brand, fontFamilies } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export function openReceipt(kind: 'transaction' | 'invoice' | 'admin-transaction' | 'admin-invoice', id: number) {
  router.push({ pathname: '/receipt', params: { kind, id: String(id) } });
}

interface InvoiceRowProps {
  invoice: Pick<
    MemberInvoice,
    'description' | 'apartmentLabel' | 'invoiceDate' | 'amount' | 'amountPaid' | 'balance' | 'status'
  >;
  subtitle?: string;
  onPress?: () => void;
}

export function InvoiceRow({ invoice, subtitle, onPress }: InvoiceRowProps) {
  const { t } = useTranslation();
  return (
    <List.Item
      onPress={onPress}
      title={invoice.description}
      titleNumberOfLines={2}
      description={[subtitle ?? invoice.apartmentLabel, formatDate(invoice.invoiceDate)].filter(Boolean).join(' · ')}
      right={() => (
        <View style={styles.right}>
          <AmountText value={invoice.status === 'paid' ? invoice.amount : invoice.balance} />
          {invoice.status === 'partial' ? (
            <Text variant="labelSmall" style={styles.muted}>
              {t('member.paidOf', { paid: formatMoney(invoice.amountPaid), amount: formatMoney(invoice.amount) })}
            </Text>
          ) : null}
          <StatusChip status={invoice.status} />
        </View>
      )}
    />
  );
}

export function TransactionRow({ transaction }: { transaction: MemberTransaction }) {
  const { t } = useTranslation();
  const receiptTarget = transaction.isWalletPayment
    ? transaction.invoiceId
      ? { kind: 'invoice' as const, id: transaction.invoiceId }
      : null
    : transaction.transactionId
      ? { kind: 'transaction' as const, id: transaction.transactionId }
      : null;
  const canOpen = transaction.hasReceipt && receiptTarget;

  return (
    <List.Item
      onPress={canOpen ? () => openReceipt(receiptTarget.kind, receiptTarget.id) : undefined}
      title={transaction.description || t('member.paymentHistory')}
      titleNumberOfLines={2}
      description={[
        transaction.apartmentLabel,
        formatDate(transaction.date),
        transaction.isWalletPayment ? t('member.walletPayment') : null
      ]
        .filter(Boolean)
        .join(' · ')}
      left={(props) => <List.Icon {...props} icon={transaction.isWalletPayment ? 'wallet-outline' : 'cash'} />}
      right={() => (
        <View style={styles.right}>
          <AmountText value={transaction.amount} tone={transaction.type === 'income' ? 'income' : 'expense'} />
          {canOpen ? (
            <Text variant="labelSmall" style={styles.link}>
              {t('common.viewReceipt')}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}

export function WalletEntryRow({ entry }: { entry: WalletEntryView }) {
  return (
    <List.Item
      title={entry.description || '—'}
      titleNumberOfLines={2}
      description={[formatDate(entry.date), entry.accountName].filter(Boolean).join(' · ')}
      right={() => (
        <View style={styles.right}>
          <AmountText value={entry.amount} tone={entry.amount >= 0 ? 'income' : 'expense'} />
          <Text variant="labelSmall" style={styles.muted}>
            {formatMoney(entry.runningBalance)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  right: { alignItems: 'flex-end', justifyContent: 'center', gap: 4, maxWidth: 160 },
  muted: { color: brand.lightText },
  link: { color: brand.primary, fontFamily: fontFamilies.medium }
});
