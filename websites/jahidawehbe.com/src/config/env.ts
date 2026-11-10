import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  PUBLIC_BASE_URL: z.url().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  SHARP_CONCURRENCY: z.coerce.number().int().min(0).max(16).default(1),
  SHARP_CACHE_MB: z.coerce.number().int().min(0).max(1024).default(0),
  YOUTUBE_SYNC_ENABLED: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((value) => value === undefined || value === '' || value === 'true' || value === '1'),
  YOUTUBE_SYNC_MINUTES: z.coerce.number().int().min(15).max(1440).default(180)
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
