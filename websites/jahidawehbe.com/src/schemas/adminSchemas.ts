import { z } from 'zod';
import {
  HERO_SLIDES_MAX,
  HOME_LIST_MAX,
  INSTAGRAM_POSTS_MAX,
  QUOTES_MAX,
  VIDEOS_MAX,
  heroFocusSchema,
  heroTextSideSchema,
  homeSectionKeys,
  menuItemSchema,
  pageKindSchema,
  socialNetworkKeys,
  textDirectionSchema,
  userRoleSchema,
  youtubeIdSchema,
  type SocialNetworkKey
} from '../domain/models.js';
import { checkbox, httpsUrl, imagePath, intField, linkUrl, optionalTrimmed, requiredTrimmed, rows, videoPath } from './formHelpers.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200)
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const stringIdParamSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export const imageIdParamsSchema = z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() });

const galleryRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  caption: optionalTrimmed(300),
  sort: intField(0, 1_000_000),
  remove: checkbox
});

const eventDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))), {
    message: 'Pick a date, or leave it empty'
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
  direction: textDirectionSchema.optional().transform((value) => value ?? 'auto'),
  sort: intField(0, 1_000_000),
  heroImage: imagePath,
  removeHeroImage: checkbox,
  heroVideo: videoPath,
  removeHeroVideo: checkbox,
  eventDate,
  venue: optionalTrimmed(200),
  linkUrl,
  linkLabel: optionalTrimmed(80),
  seoTitle: optionalTrimmed(200),
  seoDescription: optionalTrimmed(400),
  seoKeywords: optionalTrimmed(500),
  gallery: rows(galleryRowSchema, 1000)
});
export type PageFormInput = z.infer<typeof pageFormSchema>;

const richText = z.string().max(20_000, 'Must be 20000 characters or fewer').optional().transform((value) => value ?? '');

const listSection = z.object({
  enabled: checkbox,
  title: requiredTrimmed(120, 'Title'),
  intro: optionalTrimmed(400),
  count: intField(1, HOME_LIST_MAX)
});

export const homeSectionSchemas = {
  hero: z.object({
    enabled: checkbox,
    eyebrow: optionalTrimmed(120),
    title: optionalTrimmed(160),
    intro: optionalTrimmed(400),
    textSide: heroTextSideSchema.optional().transform((value) => value ?? 'bottom'),
    interval: intField(3, 30),
    ctaLabel: optionalTrimmed(80),
    ctaUrl: linkUrl,
    slides: rows(
      z.object({
        image: imagePath,
        video: videoPath,
        focus: heroFocusSchema.optional().transform((value) => value ?? 'center'),
        caption: optionalTrimmed(160)
      }),
      HERO_SLIDES_MAX
    )
  }),
  upcoming: listSection,
  videos: listSection,
  about: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    heading: optionalTrimmed(160),
    content: richText,
    image: imagePath,
    ctaLabel: optionalTrimmed(80),
    ctaUrl: linkUrl
  }),
  quotes: z.object({
    enabled: checkbox,
    title: optionalTrimmed(120),
    image: imagePath,
    items: rows(
      z.object({
        quote: requiredTrimmed(1200, 'Quote'),
        author: requiredTrimmed(120, 'Author'),
        role: optionalTrimmed(160)
      }),
      QUOTES_MAX
    )
  }),
  events: listSection,
  news: listSection
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

export const settingsFormSchema = z.object({
  siteName: requiredTrimmed(120, 'Site name'),
  tagline: optionalTrimmed(200),
  description: optionalTrimmed(400),
  logo: imagePath,
  favicon: imagePath,
  footerText: optionalTrimmed(400),
  copyright: optionalTrimmed(200),
  themeColor: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || '#0d0b0a')
    .refine((value) => /^#[0-9a-f]{6}$/i.test(value), { message: 'Use a hex colour such as #0d0b0a' }),
  seoDefaultTitle: optionalTrimmed(200),
  seoDefaultDescription: optionalTrimmed(400),
  seoDefaultKeywords: optionalTrimmed(500),
  seoDefaultImage: imagePath
});

const profileFields = Object.fromEntries(socialNetworkKeys.map((key) => [key, httpsUrl])) as Record<SocialNetworkKey, typeof httpsUrl>;

export const socialFormSchema = z.object({
  profiles: z
    .record(z.string(), z.unknown())
    .optional()
    .transform((value) => value ?? {})
    .pipe(z.object(profileFields)),
  instagramEnabled: checkbox,
  instagramTitle: requiredTrimmed(120, 'Instagram heading'),
  instagramIntro: optionalTrimmed(400),
  instagramPosts: rows(z.object({ url: requiredTrimmed(500, 'Post link') }), INSTAGRAM_POSTS_MAX)
});
export type SocialFormInput = z.infer<typeof socialFormSchema>;

export const videoChannelFormSchema = z.object({
  channel: optionalTrimmed(300),
  syncEnabled: checkbox
});

export const videoAddFormSchema = z.object({
  url: requiredTrimmed(500, 'YouTube link'),
  title: optionalTrimmed(300)
});

export const videoLibraryFormSchema = z.object({
  featured: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? '')
    .refine((value) => value === '' || youtubeIdSchema.safeParse(value).success, { message: 'Choose a video from the list' }),
  items: rows(
    z.object({
      id: youtubeIdSchema,
      title: requiredTrimmed(300, 'Title'),
      sort: intField(0, 100_000),
      hidden: checkbox,
      remove: checkbox
    }),
    VIDEOS_MAX
  )
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
