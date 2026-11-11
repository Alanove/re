import { ApiRequestError } from '@/api/client';
import i18n from '@/i18n';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) return i18n.t('common.networkError');
    return error.message;
  }
  return i18n.t('common.genericError');
}
