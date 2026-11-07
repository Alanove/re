import { z } from 'zod';

export const checkbox = z
  .union([z.literal('1'), z.literal('on'), z.literal('true'), z.array(z.string())])
  .optional()
  .transform((value) => (Array.isArray(value) ? value.includes('1') || value.includes('on') : value !== undefined));

export const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer`);

export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((value) => value ?? '');

export const requiredTrimmed = (max: number, label: string) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `Must be ${max} characters or fewer`);

export const intField = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') {
        return min > 0 ? min : 0;
      }
      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({ code: 'custom', message: `Must be a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return parsed;
    });

export const linkUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(value), {
    message: 'Use a site path starting with /, #, or a full http(s), mailto: or tel: link'
  });

export const imagePath = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || value.startsWith('/uploads/') || /^https:\/\//i.test(value), {
    message: 'Images must be uploaded files or https links'
  });

export const videoPath = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || (value.startsWith('/uploads/') && /\.(mp4|webm)$/i.test(value)), {
    message: 'Videos must be uploaded MP4 or WebM files (paths starting with /uploads/)'
  });

export function lines(max: number, itemMax: number) {
  return z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().max(itemMax, `Each line must be ${itemMax} characters or fewer`)).max(max, `Use at most ${max} lines`));
}

function isBlankRow(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }
  return Object.values(entry as Record<string, unknown>).every((value) => typeof value === 'string' && value.trim() === '');
}

export function rowIndexes(value: unknown): { kept: number[]; blank: number[] } {
  const entries: [number, unknown][] = Array.isArray(value)
    ? value.flatMap((entry, index) => (index in value ? [[index, entry] as [number, unknown]] : []))
    : value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).map(([key, entry]) => [Number.parseInt(key, 10), entry] as [number, unknown])
      : [];
  const kept: number[] = [];
  const blank: number[] = [];
  for (const [index, entry] of entries) {
    if (Number.isInteger(index)) {
      (isBlankRow(entry) ? blank : kept).push(index);
    }
  }
  return { kept, blank };
}

export function rows<T extends z.ZodType>(row: T, max: number) {
  return z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional()
    .transform((value) => {
      if (!value) {
        return [] as unknown[];
      }
      const list = Array.isArray(value) ? value : Object.values(value);
      return list.filter((entry) => !isBlankRow(entry));
    })
    .pipe(z.array(row).max(max, `Use at most ${max} rows`));
}
