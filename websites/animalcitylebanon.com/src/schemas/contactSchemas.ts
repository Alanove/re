import { z } from 'zod';
import { captchaField } from './captchaSchemas.js';

function requiredTrimmed(max: number, label: string) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const contactFormSchema = z.object({
  captcha: captchaField,
  name: requiredTrimmed(120, 'Name').refine((value) => value.length >= 2, {
    message: 'Name must be at least 2 characters'
  }),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email address')),
  subject: requiredTrimmed(200, 'Subject'),
  message: z
    .string({ error: 'Message is required' })
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(300, 'Message must be 300 characters or fewer'),
  website: z.string().trim().max(200).optional().default('')
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
