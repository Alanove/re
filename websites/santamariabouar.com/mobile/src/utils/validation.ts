import { z } from 'zod';
import i18n from '@/i18n';
import { parseAmountInput } from './format';

const t = (key: string) => i18n.t(key);

export const requiredText = () => z.string().trim().min(1, t('validation.required'));

export const isoDate = () =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, t('validation.date'))
    .refine((v) => !Number.isNaN(Date.parse(v)), t('validation.date'));

export const optionalIsoDate = () => z.union([z.literal(''), isoDate()]);

export const positiveAmount = () =>
  z.string().trim().refine((v) => {
    const n = parseAmountInput(v);
    return Number.isFinite(n) && n > 0;
  }, t('validation.amount'));

export const optionalAmount = () =>
  z.string().trim().refine((v) => {
    if (v === '') return true;
    const n = parseAmountInput(v);
    return Number.isFinite(n) && n >= 0;
  }, t('validation.amount'));

export const emailField = () => z.string().trim().email(t('validation.email'));
