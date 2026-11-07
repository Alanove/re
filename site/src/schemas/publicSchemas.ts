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
