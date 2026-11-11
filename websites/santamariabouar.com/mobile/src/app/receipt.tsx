import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';

import { adminApi, memberApi } from '@/api/endpoints';
import { ErrorState, LoadingState } from '@/components/States';
import { SITE_URL } from '@/config';

export type ReceiptKind = 'transaction' | 'invoice' | 'admin-transaction' | 'admin-invoice';

function loadReceipt(kind: ReceiptKind, id: number): Promise<string> {
  switch (kind) {
    case 'invoice':
      return memberApi.invoiceReceipt(id);
    case 'admin-transaction':
      return adminApi.transactionReceipt(id);
    case 'admin-invoice':
      return adminApi.invoiceReceipt(id);
    default:
      return memberApi.transactionReceipt(id);
  }
}

export default function ReceiptScreen() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind = (params.kind as ReceiptKind) || 'transaction';
  const id = Number(params.id);

  const receipt = useQuery({
    queryKey: ['receipt', kind, id],
    queryFn: () => loadReceipt(kind, id),
    enabled: Number.isInteger(id) && id > 0
  });

  if (receipt.isPending) return <LoadingState />;
  if (receipt.isError) return <ErrorState error={receipt.error} onRetry={() => receipt.refetch()} />;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.web}>
        <Text>Receipts are available in the iOS and Android apps.</Text>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: receipt.data, baseUrl: SITE_URL }}
      style={styles.webview}
      startInLoadingState
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
  web: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }
});
