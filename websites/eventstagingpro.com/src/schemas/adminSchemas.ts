import { z } from 'zod';
import {
  HERO_SLIDES_MAX,
  homeSectionKeys,
  menuItemSchema,
  pageKindSchema,
  userRoleSchema
} from '../domain/models.js';
import {
  checkbox,
  httpsUrl,
  imagePath,
  intField,
  lines,
  linkUrl,
  materialIcon,
  optionalTrimmed,
  requiredTrimmed,
  rows,
  videoPath
} from './formHelpers.js';
import { captchaField } from './captchaSchemas.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200),
  captcha: captchaField
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const stringIdParamSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export const uuidParamSchema = z.object({ id: z.uuid() });
export const imageIdParamsSchema = z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() });

const galleryRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  caption: optionalTrimmed(300),
  sort: intField(0, 1_000_000),
  remove: checkbox
});

export const pageFormSchema = z.object({
  title: requiredTrimmed(200, 'Title'),
  header: optionalTrimmed(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value === '' || /^[a-z0-9][a-z0-9_-]*$/.test(value), {
      message: 'Use lowercase letters, numbers, dashes or underscores'
    }),
  parentId: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : Number.parseInt(value, 10)))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), { message: 'Choose a valid parent page' }),
  summary: optionalTrimmed(2000),
  content: z.string().max(500_000).optional().transform((value) => value ?? ''),
  published: checkbox,
  kind: pageKindSchema,
  sort: intField(0, 1_000_000),
  icon: materialIcon,
  heroImage: imagePath,
  removeHeroImage: checkbox,
  heroVideo: videoPath,
  removeHeroVideo: checkbox,
  seoTitle: optionalTrimmed(200),
  seoDescription: optionalTrimmed(400),
  seoKeywords: optionalTrimmed(500),
  gallery: rows(galleryRowSchema, 1000)
});
export type PageFormInput = z.infer<typeof pageFormSchema>;

const richText = z.string().max(20_000, 'Must be 20000 characters or fewer').optional().transform((value) => value ?? '');

export const homeSectionSchemas = {
  hero: z.object({
    enabled: checkbox,
    interval: intField(3, 30),
    slides: rows(
      z.object({
        title: requiredTrimmed(160, 'Slide title'),
        label: optionalTrimmed(500),
        url: linkUrl,
        image: imagePath
      }),
      HERO_SLIDES_MAX
    )
  }),
  about: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    content: richText,
    image: imagePath
  }),
  latestPosts: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(600),
    limit: intField(1, 6)
  }),
  gallery: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(600)
  })
} as const;

const albumImageRowSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
    }),
  caption: optionalTrimmed(300),
  src: imagePath,
  sort: intField(0, 100_000),
  remove: checkbox
});

export const albumFormSchema = z.object({
  title: requiredTrimmed(200, 'Title'),
  summary: optionalTrimmed(2000),
  cover: imagePath,
  removeCover: checkbox,
  status: z.enum(['published', 'draft'], { error: 'Choose a status' }),
  sort: intField(0, 100_000),
  images: rows(albumImageRowSchema, 400)
});
export type AlbumFormInput = z.infer<typeof albumFormSchema>;

export const albumCreateSchema = z.object({
  title: requiredTrimmed(200, 'Title')
});

export const videoFormSchema = z
  .object({
    title: requiredTrimmed(200, 'Title'),
    summary: optionalTrimmed(2000),
    thumb: imagePath,
    removeThumb: checkbox,
    provider: z.enum(['youtube', 'facebook'], { error: 'Choose YouTube or Facebook' }),
    watchUrl: requiredTrimmed(500, 'Video link'),
    status: z.enum(['published', 'draft'], { error: 'Choose a status' }),
    sort: intField(0, 100_000)
  })
  .superRefine((value, ctx) => {
    if (value.provider === 'youtube' && !/youtu\.be\/|youtube(?:-nocookie)?\.com\//i.test(value.watchUrl)) {
      ctx.addIssue({ code: 'custom', path: ['watchUrl'], message: 'Paste a YouTube link' });
    }
    if (value.provider === 'facebook' && !/facebook\.com\//i.test(value.watchUrl)) {
      ctx.addIssue({ code: 'custom', path: ['watchUrl'], message: 'Paste a Facebook video link' });
    }
  });
export type VideoFormInput = z.infer<typeof videoFormSchema>;

export const videoCreateSchema = z.object({
  title: requiredTrimmed(200, 'Title')
});

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

export const officeFormSchema = z.object({
  id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, 'Use 2-40 lowercase letters, numbers or dashes'),
  country: requiredTrimmed(80, 'Country'),
  role: optionalTrimmed(120),
  address: optionalTrimmed(300),
  poBox: optionalTrimmed(80),
  phones: lines(8, 40),
  fax: optionalTrimmed(40),
  emails: lines(4, 254).pipe(z.array(z.email('Each email line must be a valid address'))),
  mapQuery: optionalTrimmed(200),
  isPrimary: checkbox,
  sort: intField(0, 10_000)
});

export const settingsFormSchema = z.object({
  siteName: requiredTrimmed(120, 'Site name'),
  tagline: optionalTrimmed(200),
  description: optionalTrimmed(400),
  logo: imagePath,
  favicon: imagePath,
  contactEmail: z.string().trim().pipe(z.email('Enter a valid email address')),
  contactPhone: optionalTrimmed(40),
  whatsappNumber: optionalTrimmed(40).refine((value) => {
    if (value === '') {
      return true;
    }
    if (!/^\+?[0-9][0-9\s().-]*$/.test(value)) {
      return false;
    }
    const digits = value.replace(/\D/g, '').replace(/^00/, '');
    return digits.length >= 8 && digits.length <= 15;
  }, { message: 'Enter a WhatsApp number with country code, for example +961 76 073 760' }),
  brochureUrl: linkUrl,
  footerText: optionalTrimmed(400),
  copyright: optionalTrimmed(200),
  inquiryTopics: lines(12, 80).pipe(z.array(z.string()).min(1, 'Add at least one inquiry topic')),
  themeColor: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || '#0b3a5b')
    .refine((value) => /^#[0-9a-f]{6}$/i.test(value), { message: 'Use a hex colour such as #0b3a5b' }),
  socialFacebook: httpsUrl,
  socialInstagram: httpsUrl,
  socialLinkedin: httpsUrl,
  socialYoutube: httpsUrl,
  socialTwitter: httpsUrl,
  ctaTitle: optionalTrimmed(160),
  ctaText: optionalTrimmed(400),
  ctaLabel: optionalTrimmed(80),
  thankYouMessage: requiredTrimmed(400, 'Thank-you message'),
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