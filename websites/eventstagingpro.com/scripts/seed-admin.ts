import 'dotenv/config';
import { z } from 'zod';
import { usersService } from '../src/services/usersService.js';

const seedSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email('ADMIN_EMAIL must be a valid email address')),
  ADMIN_PASSWORD: z
    .string()
    .min(12, 'ADMIN_PASSWORD must be at least 12 characters')
    .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
      message: 'ADMIN_PASSWORD needs upper and lower case letters and a number'
    }),
  ADMIN_NAME: z.string().trim().min(1).max(120).default('Administrator')
});

async function main(): Promise<void> {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = parsed.data;
  const { user, created } = await usersService.upsertSeedAdmin(ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD);
  console.info(`${created ? 'Created' : 'Updated'} administrator ${user.email} (id ${user.id}).`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
