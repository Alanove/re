import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { adminApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { Alert } from './ui';

export function useCanWrite(): boolean {
  return Boolean(useAuth().user?.canWriteAdmin);
}

export function ReadOnlyNotice() {
  const { t } = useTranslation();
  const canWrite = useCanWrite();
  return (
    <Alert visible={!canWrite} tone="info">
      {t('common.readOnly')}
    </Alert>
  );
}

export function useAccounts() {
  return useQuery({ queryKey: ['admin', 'accounts'], queryFn: adminApi.accounts, staleTime: 60_000 });
}

export function useCategories() {
  return useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories, staleTime: 5 * 60_000 });
}

export const searchApartments = (term: string) => adminApi.apartments(term);
