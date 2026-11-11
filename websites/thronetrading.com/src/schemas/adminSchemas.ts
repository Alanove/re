import { z } from 'zod';
import {
  HERO_SLIDES_MAX,
  HOME_LIST_MAX,
  PRODUCT_IMAGES_MAX,
  PRODUCT_SPECS_MAX,
  WHY_US_MAX,
  homeSectionKeys,
  menuItemSchema,
  pageKindSchema,
  userRoleSchema
} from '../domain/models.js';
import {
  checkbox,
  emptyAsUndefined,
  httpsUrl,
  idList,
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

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200)
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

export const homeSectionSchemas = {
  hero: z.object({
    enabled: checkbox,
    slides: rows(
      z.object({
        title: requiredTrimmed(200, 'Slide title'),
        text: optionalTrimmed(600),
        image: imagePath,
        video: videoPath,
        removeVideo: checkbox,
        zoom: z
          .union([z.literal(''), z.literal('none'), z.literal('in'), z.literal('out')])
          .optional()
          .transform((value) => (value === 'in' || value === 'out' ? value : 'none')),
        primaryLabel: optionalTrimmed(80),
        primaryUrl: linkUrl,
        secondaryLabel: optionalTrimmed(80),
        secondaryUrl: linkUrl
      }),
      HERO_SLIDES_MAX
    )
  }),
  about: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    lead: optionalTrimmed(1200),
    text: optionalTrimmed(1200),
    image: imagePath,
    statValue: optionalTrimmed(20),
    statLabel: optionalTrimmed(60),
    ctaLabel: optionalTrimmed(80),
    ctaUrl: linkUrl
  }),
  categories: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(400),
    categoryIds: idList(HOME_LIST_MAX)
  }),
  brands: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(400)
  }),
  featuredProducts: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(400),
    limit: intField(1, HOME_LIST_MAX),
    ctaLabel: optionalTrimmed(80),
    ctaUrl: linkUrl
  }),
  whyUs: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(400),
    image: imagePath,
    items: rows(
      z.object({
        title: requiredTrimmed(120, 'Item title'),
        text: optionalTrimmed(400),
        icon: materialIcon
      }),
      WHY_US_MAX
    )
  }),
  contact: z.object({
    enabled: checkbox,
    title: requiredTrimmed(120, 'Title'),
    intro: optionalTrimmed(400)
  })
} as const;

export const homeSectionParamSchema = z.object({
  key: z.enum(homeSectionKeys)
});

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .optional()
  .transform((value) => value ?? '')
  .refine((value) => value === '' || /^[a-z0-9][a-z0-9-]*$/.test(value), {
    message: 'Use lowercase letters, numbers and dashes'
  });

const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : Number.parseInt(value, 10)))
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), { message: 'Choose a valid option' });

const catalogSeoFields = {
  seoTitle: optionalTrimmed(200),
  seoDescription: optionalTrimmed(400),
  seoKeywords: optionalTrimmed(500)
};

export const categoryFormSchema = z.object({
  name: requiredTrimmed(120, 'Name'),
  slug: slugField,
  summary: optionalTrimmed(600),
  description: z.string().max(200_000).optional().transform((value) => value ?? ''),
  image: imagePath,
  icon: materialIcon,
  published: checkbox,
  sort: intField(0, 1_000_000),
  ...catalogSeoFields
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export const brandFormSchema = z.object({
  name: requiredTrimmed(120, 'Name'),
  slug: slugField,
  summary: optionalTrimmed(600),
  description: z.string().max(200_000).optional().transform((value) => value ?? ''),
  website: linkUrl,
  logo: imagePath,
  published: checkbox,
  featured: checkbox,
  sort: intField(0, 1_000_000),
  ...catalogSeoFields
});
export type BrandFormInput = z.infer<typeof brandFormSchema>;

export const productFormSchema = z.object({
  name: requiredTrimmed(160, 'Name'),
  slug: slugField,
  categoryId: z
    .string({ error: 'Choose a category' })
    .min(1, 'Choose a category')
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0, { message: 'Choose a category' }),
  brandId: optionalId,
  model: optionalTrimmed(80),
  tagline: optionalTrimmed(300),
  summary: optionalTrimmed(1000),
  description: z.string().max(200_000).optional().transform((value) => value ?? ''),
  specs: rows(
    z.object({
      label: requiredTrimmed(120, 'Specification label'),
      value: requiredTrimmed(400, 'Specification value')
    }),
    PRODUCT_SPECS_MAX
  ),
  images: rows(
    z.object({
      src: imagePath.refine((value) => value !== '', { message: 'Image path is missing' }),
      alt: optionalTrimmed(200),
      sort: intField(0, 1_000_000),
      remove: checkbox
    }),
    PRODUCT_IMAGES_MAX
  ),
  featured: checkbox,
  published: checkbox,
  sort: intField(0, 1_000_000),
  ...catalogSeoFields
});
export type ProductFormInput = z.infer<typeof productFormSchema>;

export const productListQuerySchema = z.object({
  q: optionalTrimmed(120),
  category: emptyAsUndefined(
    z
      .string()
      .regex(/^\d{1,10}$/)
      .optional()
      .transform((value) => (value ? Number(value) : null))
  ),
  brand: emptyAsUndefined(
    z
      .string()
      .regex(/^(\d{1,10}|none)$/)
      .optional()
      .transform((value) => (value === undefined ? null : value === 'none' ? 'none' : Number(value)))
  ),
  status: emptyAsUndefined(z.enum(['published', 'draft']).optional())
});

export const catalogSlugCheckSchema = z.object({
  type: z.enum(['category', 'brand', 'product']),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  parentId: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : null))
    .pipe(z.number().int().positive().nullable()),
  excludeId: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : null))
    .pipe(z.number().int().positive().nullable())
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
  }, { message: 'Enter a WhatsApp number with country code, for example +965 2227 2270' }),
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