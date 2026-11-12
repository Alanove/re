import { z } from 'zod';
import { donationCurrencySchema, donationFrequencySchema } from '../domain/models.js';
import { optionalTrimmed, requiredTrimmed } from './formHelpers.js';

const fullName = requiredTrimmed(120, 'Full name').refine((value) => value.length >= 2, { message: 'Full name must be at least 2 characters' });

const emailField = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email address'));

const phoneField = optionalTrimmed(40).refine((value) => value === '' || /^[+()\d\s.-]{6,40}$/.test(value), {
  message: 'Enter a valid phone number'
});

export const contactFormSchema = z.object({
  name: fullName,
  email: emailField,
  company: optionalTrimmed(160),
  phone: phoneField,
  topic: requiredTrimmed(80, 'Topic'),
  message: z
    .string({ error: 'Message is required' })
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be 5000 characters or fewer'),
  productId: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((value) => (value ? value : ''))
    .refine((value) => value === '' || /^\d{1,10}$/.test(value), { message: 'Unknown product' })
    .transform((value) => (value === '' ? null : Number(value))),
  website: optionalTrimmed(200)
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const donationFormSchema = z.object({
  name: fullName,
  email: emailField,
  phone: phoneField,
  amount: z
    .string({ error: 'Amount is required' })
    .trim()
    .transform((value) => value.replace(/[\s,]/g, ''))
    .pipe(z.string().min(1, 'Amount is required').regex(/^\d{1,10}$/, 'Enter a whole amount, for example 50'))
    .transform(Number)
    .pipe(z.number().int().min(1, 'Amount must be at least 1').max(1_000_000_000, 'Amount is too large')),
  currency: donationCurrencySchema,
  frequency: donationFrequencySchema,
  cause: requiredTrimmed(120, 'Cause'),
  message: optionalTrimmed(2000),
  website: optionalTrimmed(200)
});

export type DonationFormInput = z.infer<typeof donationFormSchema>;

export const donationQuerySchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/)
    .transform(Number)
    .optional()
    .catch(undefined),
  sent: z.literal('1').optional().catch(undefined)
});
