import { z } from 'zod';
import { optionalTrimmed, requiredTrimmed } from './formHelpers.js';

export const contactFormSchema = z.object({
  name: requiredTrimmed(120, 'Full name').refine((value) => value.length >= 2, { message: 'Full name must be at least 2 characters' }),
  email: z
    .string({ error: 'Work email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Work email is required')
    .pipe(z.email('Enter a valid email address')),
  company: optionalTrimmed(160),
  phone: optionalTrimmed(40).refine((value) => value === '' || /^[+()\d\s.-]{6,40}$/.test(value), {
    message: 'Enter a valid phone number'
  }),
  topic: requiredTrimmed(80, 'Service inquiry'),
  message: z
    .string({ error: 'Message is required' })
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be 5000 characters or fewer'),
  website: optionalTrimmed(200)
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const productEnquirySchema = contactFormSchema.omit({ topic: true }).extend({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email address')),
  productId: z.coerce.number({ error: 'Choose a product' }).int().positive()
});

export type ProductEnquiryInput = z.infer<typeof productEnquirySchema>;

export const catalogPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  brand: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,79}$/)
    .optional()
});

export const catalogSlugParamsSchema = z.object({
  category: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/i),
  product: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,79}$/i)
    .optional()
});

export const brandSlugParamsSchema = z.object({ brand: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i) });
