import { z } from 'zod';
import {
  directionSchema,
  HOME_LIST_MAX,
  HOME_SECTIONS_MAX,
  homeSectionKeys,
  menuItemSchema,
  pageKindSchema,
  SLUG_PATTERN,
  sitePathSchema,
  submissionTypeSchema,
  userRoleSchema
} from '../domain/models.js';
import { checkbox, httpsUrl, idList, imagePath, intField, lines, linkUrl, materialIcon, optionalTrimmed, requiredTrimmed, rows, videoPath } from './formHelpers.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200)
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const stringIdParamSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export const uuidParamSchema = z.object({ id: z.uuid() });
export const imageIdParamsSchema = z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() });

/** Optional URL segment in Arabic or Latin letters; an empty value means "derive it from the title". */
const slugInput = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ?? '').normalize('NFC').replace(/\s+/g, '-'))
  .refine((value) => value === '' || SLUG_PATTERN.test(value), { message: 'Use letters, numbers, dashes or underscores (no slashes)' });

const directionInput = directionSchema.optional().transform((value) => value ?? 'auto');

const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : Number.parseInt(value, 10)))
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), { message: 'Choose a valid item' });

const dateInput = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return null;
    }
    const date = new Date(`${value.length === 10 ? `${value}T08:00:00` : value}Z`);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) || Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Use a date such as 2024-05-31' });
      return z.NEVER;
    }
    return date.toISOString();
  });

const seoFields = {
  seoTitle: optionalTrimmed(200),
  seoDescription: optionalTrimmed(400),
  seoKeywords: optionalTrimmed(500)
};

const galleryRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  caption: optionalTrimmed(300),
  sort: intField(0, 1_000_000),
  remove: checkbox
});

export const pageFormSchema = z.object({
  title: requiredTrimmed(200, 'Title'),
  header: optionalTrimmed(200),
  slug: slugInput,
  parentId: optionalId,
  summary: optionalTrimmed(2000),
  content: z.string().max(500_000).optional().transform((value) => value ?? ''),
  published: checkbox,
  kind: pageKindSchema,
  direction: directionInput,
  sort: intField(0, 1_000_000),
  icon: materialIcon,
  heroImage: imagePath,
  removeHeroImage: checkbox,
  heroVideo: videoPath,
  removeHeroVideo: checkbox,
  ...seoFields,
  gallery: rows(galleryRowSchema, 1000)
});
export type PageFormInput = z.infer<typeof pageFormSchema>;

export const sectionFormSchema = z.object({
  title: requiredTrimmed(160, 'Title'),
  path: z
    .string()
    .trim()
    .transform((value) => value.normalize('NFC').replace(/\s+/g, '-').replace(/\/+$/, ''))
    .pipe(sitePathSchema),
  intro: optionalTrimmed(2000),
  image: imagePath,
  removeImage: checkbox,
  published: checkbox,
  sort: intField(0, 100_000),
  ...seoFields
});
export type SectionFormInput = z.infer<typeof sectionFormSchema>;

export const articleFormSchema = z.object({
  title: requiredTrimmed(250, 'Title'),
  slug: slugInput,
  sectionId: z.coerce.number({ error: 'Choose a section' }).int().positive('Choose a section'),
  summary: optionalTrimmed(2000),
  content: z.string().max(1_000_000).optional().transform((value) => value ?? ''),
  image: imagePath,
  removeImage: checkbox,
  direction: directionInput,
  tags: z
    .string()
    .optional()
    .transform((value) =>
      [
        ...new Set(
          (value ?? '')
            .split(/[,،\n]/)
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean)
        )
      ]
    )
    .pipe(z.array(z.string().max(80, 'Each tag must be 80 characters or fewer')).max(30, 'Use at most 30 tags')),
  published: checkbox,
  publishedAt: dateInput,
  ...seoFields
});
export type ArticleFormInput = z.infer<typeof articleFormSchema>;

export const articleListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined).transform((value) => value ?? ''),
  section: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(['published', 'draft']).optional().catch(undefined),
  p: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined)
});

export const bookFormSchema = z.object({
  title: requiredTrimmed(300, 'Title'),
  author: optionalTrimmed(300),
  publisher: optionalTrimmed(300),
  language: optionalTrimmed(80),
  genre: optionalTrimmed(120),
  subject: optionalTrimmed(300),
  format: optionalTrimmed(80),
  year: optionalTrimmed(20),
  pageCount: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0 && value < 100_000), { message: 'Use a whole number of pages' }),
  notes: optionalTrimmed(2000),
  active: checkbox
});
export type BookFormInput = z.infer<typeof bookFormSchema>;

/** Column order of the books spreadsheet used by the CSV bulk edit. */
export const BOOK_CSV_COLUMNS = ['id', 'title', 'author', 'publisher', 'language', 'genre', 'subject', 'format', 'year', 'pageCount', 'notes', 'active'] as const;

/** One spreadsheet row. An empty `id` adds a book; `active` accepts yes/no, 1/0, true/false or نعم/لا and defaults to yes. */
export const bookCsvRowSchema = bookFormSchema.omit({ active: true }).extend({
  id: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), { message: 'The id must be a whole number or empty' }),
  active: z
    .string()
    .trim()
    .optional()
    .transform((value) => !/^(0|no|false|لا|n)$/i.test(value ?? ''))
});
export type BookCsvRow = z.infer<typeof bookCsvRowSchema>;

export const catalogListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined).transform((value) => value ?? ''),
  p: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined)
});

export const hymnFormSchema = z.object({
  title: requiredTrimmed(250, 'Title'),
  file: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value === '' || (value.startsWith('/uploads/') && /\.(mp3|m4a|wma)$/i.test(value)), { message: 'Upload an MP3 file' }),
  singer: optionalTrimmed(250),
  author: optionalTrimmed(250),
  album: optionalTrimmed(250),
  category: optionalTrimmed(160),
  sort: intField(0, 100_000),
  active: checkbox
});
export type HymnFormInput = z.infer<typeof hymnFormSchema>;

const albumImageRowSchema = z.object({
  src: imagePath.refine((value) => value !== '', { message: 'Missing image' }),
  caption: optionalTrimmed(300),
  sort: intField(0, 1_000_000),
  remove: checkbox
});

export const albumFormSchema = z.object({
  title: requiredTrimmed(200, 'Title'),
  slug: slugInput,
  summary: optionalTrimmed(1000),
  published: checkbox,
  publishedAt: dateInput,
  sort: intField(0, 100_000),
  images: rows(albumImageRowSchema, 500)
});
export type AlbumFormInput = z.infer<typeof albumFormSchema>;

/** Accepts a YouTube link (watch, youtu.be, embed, shorts) or a bare video id and keeps the id. */
const youtubeInput = z
  .string({ error: 'YouTube link is required' })
  .trim()
  .min(1, 'YouTube link is required')
  .max(300)
  .transform((value, ctx) => {
    const match =
      /^[\w-]{6,20}$/.exec(value)?.[0] ??
      /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i.exec(value)?.[1];
    if (!match) {
      ctx.addIssue({ code: 'custom', message: 'Paste a YouTube link such as https://www.youtube.com/watch?v=…' });
      return z.NEVER;
    }
    return match;
  });

export const videoFormSchema = z.object({
  title: requiredTrimmed(200, 'Title'),
  slug: slugInput,
  summary: optionalTrimmed(1000),
  youtube: youtubeInput,
  image: imagePath,
  removeImage: checkbox,
  direction: directionInput,
  published: checkbox,
  publishedAt: dateInput,
  sort: intField(0, 100_000)
});
export type VideoFormInput = z.infer<typeof videoFormSchema>;

export const purchaseFormSchema = z.object({
  title: requiredTrimmed(250, 'Title'),
  slug: slugInput,
  category: requiredTrimmed(120, 'Category'),
  author: optionalTrimmed(250),
  price: optionalTrimmed(60),
  summary: optionalTrimmed(2000),
  content: z.string().max(500_000).optional().transform((value) => value ?? ''),
  image: imagePath,
  removeImage: checkbox,
  published: checkbox,
  sort: intField(0, 100_000)
});
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;

const homeListFields = {
  enabled: checkbox,
  title: requiredTrimmed(120, 'Heading'),
  count: intField(1, HOME_LIST_MAX)
};

export const homeSectionSchemas = {
  spotlight: z.object({ ...homeListFields, sectionId: optionalId }),
  sections: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Heading'),
    sectionIds: idList(HOME_SECTIONS_MAX),
    count: intField(1, 6)
  }),
  questions: z.object({ ...homeListFields, sectionId: optionalId, intro: optionalTrimmed(400) }),
  hymns: z.object({ ...homeListFields, intro: optionalTrimmed(400) }),
  videos: z.object(homeListFields),
  albums: z.object(homeListFields),
  newsletter: z.object({
    enabled: checkbox,
    title: requiredTrimmed(160, 'Heading'),
    text: optionalTrimmed(400)
  })
} as const;

export const homeSectionParamSchema = z.object({
  key: z.enum(homeSectionKeys)
});

const menuItemsJson = z
  .string()
  .max(200_000)
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Menu items are not valid JSON' });
      return z.NEVER;
    }
  })
  .pipe(z.array(menuItemSchema).max(60));

export const menuFormSchema = z.object({
  name: requiredTrimmed(120, 'Name'),
  description: optionalTrimmed(300),
  items: menuItemsJson
});

export const menuCreateSchema = z.object({
  id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, 'Use 2-40 lowercase letters, numbers or dashes'),
  name: requiredTrimmed(120, 'Name'),
  description: optionalTrimmed(300)
});

export const inquiriesQuerySchema = z.object({
  type: submissionTypeSchema.optional().catch(undefined)
});

const relatedLinkRow = z.object({
  label: requiredTrimmed(80, 'Link label'),
  url: linkUrl.refine((value) => value !== '', { message: 'Link address is required' })
});

export const settingsFormSchema = z.object({
  siteName: requiredTrimmed(120, 'Site name'),
  tagline: optionalTrimmed(200),
  description: optionalTrimmed(400),
  logo: imagePath,
  emblem: imagePath,
  favicon: imagePath,
  contactEmail: z.string().trim().pipe(z.email('Enter a valid email address')),
  contactPhone: optionalTrimmed(40),
  address: optionalTrimmed(300),
  mapQuery: optionalTrimmed(200),
  footerText: optionalTrimmed(400),
  copyright: optionalTrimmed(200),
  inquiryTopics: lines(12, 80).pipe(z.array(z.string()).min(1, 'Add at least one inquiry topic')),
  themeColor: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || '#007d90')
    .refine((value) => /^#[0-9a-f]{6}$/i.test(value), { message: 'Use a hex colour such as #007d90' }),
  socialFacebook: httpsUrl,
  socialX: httpsUrl,
  socialInstagram: httpsUrl,
  socialYoutube: httpsUrl,
  relatedLinks: rows(relatedLinkRow, 8),
  thankYouMessage: requiredTrimmed(400, 'Thank-you message'),
  newsletterThankYou: requiredTrimmed(400, 'Newsletter thank-you message'),
  seoDefaultTitle: optionalTrimmed(200),
  seoDefaultDescription: optionalTrimmed(400),
  seoDefaultKeywords: optionalTrimmed(500),
  seoDefaultImage: imagePath
});

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200)
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: 'Password needs upper and lower case letters and a number'
  });

const optionalPassword = z
  .string()
  .optional()
  .transform((value) => value ?? '')
  .pipe(z.union([z.literal(''), passwordSchema]));

export const userCreateSchema = z
  .object({
    name: requiredTrimmed(120, 'Name'),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
    role: userRoleSchema,
    active: checkbox,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const userUpdateSchema = z
  .object({
    name: requiredTrimmed(120, 'Name'),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
    role: userRoleSchema,
    active: checkbox,
    password: optionalPassword,
    confirmPassword: z.string().optional().transform((value) => value ?? '')
  })
  .refine((value) => value.password === value.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const profileSchema = z
  .object({
    name: requiredTrimmed(120, 'Name'),
    currentPassword: z.string().max(200).optional().transform((value) => value ?? ''),
    password: optionalPassword,
    confirmPassword: z.string().optional().transform((value) => value ?? '')
  })
  .refine((value) => value.password === value.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((value) => value.password === '' || value.currentPassword.length > 0, {
    message: 'Enter your current password to set a new one',
    path: ['currentPassword']
  });

export const pageImagesQuerySchema = z.object({
  pageKey: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value ?? 'generic'),
  pageId: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/)
    .optional()
});

export const uploadImageBodySchema = z.object({
  pageKey: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value ?? 'generic')
});
