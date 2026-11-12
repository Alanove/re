import { z } from 'zod';
import { searchTypes } from '../domain/search.js';
import { optionalTrimmed } from './formHelpers.js';

const requiredText = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `الحد الأقصى ${max} حرفاً`);

const fullName = requiredText(120, 'الاسم مطلوب').refine((value) => value.length >= 2, { message: 'الاسم قصير جداً' });

const emailField = z
  .string({ error: 'البريد الإلكتروني مطلوب' })
  .trim()
  .toLowerCase()
  .min(1, 'البريد الإلكتروني مطلوب')
  .max(254)
  .pipe(z.email('أدخل بريداً إلكترونياً صحيحاً'));

const phoneField = optionalTrimmed(40).refine((value) => value === '' || /^[+()\d\s.-]{6,40}$/.test(value), {
  message: 'أدخل رقم هاتف صحيحاً'
});

export const contactFormSchema = z.object({
  name: fullName,
  email: emailField,
  phone: phoneField,
  topic: requiredText(80, 'اختر موضوع الرسالة'),
  message: z.string({ error: 'الرسالة مطلوبة' }).trim().min(10, 'الرسالة قصيرة جداً (10 أحرف على الأقل)').max(5000, 'الرسالة طويلة جداً'),
  purchaseId: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value === '' || /^\d{1,10}$/.test(value), { message: 'عنصر غير معروف' })
    .transform((value) => (value === '' ? null : Number(value))),
  website: optionalTrimmed(200)
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const newsletterFormSchema = z.object({
  email: emailField,
  website: optionalTrimmed(200)
});

const pageNumber = z.coerce.number().int().min(1).max(10_000).optional().catch(undefined).transform((value) => value ?? 1);
const queryText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .catch(undefined)
  .transform((value) => value ?? '');
const facetText = z
  .string()
  .trim()
  .max(160)
  .optional()
  .catch(undefined)
  .transform((value) => value ?? '');

export const listingQuerySchema = z.object({ p: pageNumber });

export const searchQuerySchema = z.object({
  q: queryText,
  type: z.enum(searchTypes).optional().catch(undefined).transform((value) => value ?? null),
  section: z.coerce.number().int().positive().optional().catch(undefined).transform((value) => value ?? null),
  p: pageNumber
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(80)
});

export const libraryQuerySchema = z.object({
  q: queryText,
  genre: facetText,
  language: facetText,
  author: facetText,
  p: pageNumber
});

export const hymnsQuerySchema = z.object({
  q: queryText,
  category: facetText
});

export const contactQuerySchema = z.object({
  sent: z.literal('1').optional().catch(undefined),
  item: z.coerce.number().int().positive().optional().catch(undefined)
});
