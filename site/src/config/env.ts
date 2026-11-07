import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  PUBLIC_BASE_URL: z.url().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanString,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default(''),
  MAIL_TO: z.string().optional().default('')
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

const devCredentialSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_PASSWORD: z.string().min(1)
});

function readDevLoginCredentials(): { email: string; password: string } | null {
  if (!isDevelopment) {
    return null;
  }
  const parsed = devCredentialSchema.safeParse(process.env);
  if (!parsed.success) {
    return null;
  }
  return { email: parsed.data.ADMIN_EMAIL, password: parsed.data.ADMIN_PASSWORD };
}

export const devLoginCredentials = readDevLoginCredentials();
