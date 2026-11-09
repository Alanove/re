import { z } from 'zod';

const localOrRemoteUrl = z.string().max(2048);
const isoDate = z.iso.datetime();

export const pageStatusSchema = z.enum(['published', 'draft']);
export const pageKindSchema = z.enum(['page', 'section', 'contact', 'footer']);

export const pageSchema = z.object({
  id: z.number().int().positive(),
  key: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  parentId: z.number().int().positive().nullable(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().min(1).max(200),
  header: z.string().max(200),
  summary: z.string().max(2000),
  content: z.string(),
  status: pageStatusSchema,
  kind: pageKindSchema,
  sort: z.number().int(),
  icon: z.string().max(60),
  heroImage: localOrRemoteUrl,
  heroVideo: localOrRemoteUrl.default(''),
  seo: z.object({
    title: z.string().max(200),
    description: z.string().max(400),
    keywords: z.string().max(500)
  }),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Page = z.infer<typeof pageSchema>;
export const pagesFileSchema = z.array(pageSchema);

export const pageImageSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  sort: z.number().int(),
  caption: z.string().max(300),
  src: localOrRemoteUrl,
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  createdAt: isoDate
});
export type PageImage = z.infer<typeof pageImageSchema>;
export const pageImagesFileSchema = z.array(pageImageSchema);

export interface MenuItem {
  id: string;
  title: string;
  url: string;
  pageId: number | null;
  sort: number;
  active: boolean;
  children: MenuItem[];
}
export const menuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(120),
    url: z.string().min(1).max(500),
    pageId: z.number().int().positive().nullable(),
    sort: z.number().int(),
    active: z.boolean(),
    children: z.array(menuItemSchema)
  })
);
export const menuSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(300),
  items: z.array(menuItemSchema)
});
export type Menu = z.infer<typeof menuSchema>;
export const menusFileSchema = z.array(menuSchema);

export const linkSchema = z.object({ label: z.string().max(80), url: z.string().max(500) });
export type Link = z.infer<typeof linkSchema>;

export const HERO_SLIDES_MAX = 6;

export const heroZoomSchema = z.enum(['none', 'in', 'out']);
export type HeroZoom = z.infer<typeof heroZoomSchema>;

export const heroSlideSchema = z.object({
  title: z.string().min(1).max(200),
  text: z.string().max(600),
  image: localOrRemoteUrl,
  video: localOrRemoteUrl,
  zoom: heroZoomSchema.catch('none'),
  primaryCta: linkSchema,
  secondaryCta: linkSchema
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

export const HOME_LIST_MAX = 12;
export const WHY_US_MAX = 6;

export const homeSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    slides: z.array(heroSlideSchema).max(HERO_SLIDES_MAX)
  }),
  about: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    lead: z.string().max(1200),
    text: z.string().max(1200),
    image: localOrRemoteUrl,
    statValue: z.string().max(20),
    statLabel: z.string().max(60),
    cta: linkSchema
  }),
  categories: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    categoryIds: z.array(z.number().int().positive()).max(HOME_LIST_MAX)
  }),
  brands: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400)
  }),
  featuredProducts: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    limit: z.number().int().min(1).max(HOME_LIST_MAX),
    cta: linkSchema
  }),
  whyUs: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    image: localOrRemoteUrl,
    items: z
      .array(
        z.object({
          title: z.string().min(1).max(120),
          text: z.string().max(400),
          icon: z.string().max(60)
        })
      )
      .max(WHY_US_MAX)
  }),
  contact: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400)
  }),
  updatedAt: isoDate
});
export type Home = z.infer<typeof homeSchema>;
export const homeSectionKeys = ['hero', 'about', 'categories', 'brands', 'featuredProducts', 'whyUs', 'contact'] as const;
export type HomeSectionKey = (typeof homeSectionKeys)[number];

export const catalogStatusSchema = z.enum(['published', 'draft']);
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
const catalogSlug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(80);
const catalogSeoSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(400),
  keywords: z.string().max(500)
});

export const brandSchema = z.object({
  id: z.number().int().positive(),
  slug: catalogSlug,
  name: z.string().min(1).max(120),
  logo: localOrRemoteUrl,
  summary: z.string().max(600),
  description: z.string(),
  website: z.string().max(500),
  status: catalogStatusSchema,
  featured: z.boolean(),
  sort: z.number().int(),
  seo: catalogSeoSchema,
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Brand = z.infer<typeof brandSchema>;
export const brandsFileSchema = z.array(brandSchema);

export const categorySchema = z.object({
  id: z.number().int().positive(),
  slug: catalogSlug,
  name: z.string().min(1).max(120),
  summary: z.string().max(600),
  description: z.string(),
  image: localOrRemoteUrl,
  icon: z.string().max(60),
  status: catalogStatusSchema,
  sort: z.number().int(),
  seo: catalogSeoSchema,
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Category = z.infer<typeof categorySchema>;
export const categoriesFileSchema = z.array(categorySchema);

export const PRODUCT_SPECS_MAX = 40;
export const PRODUCT_IMAGES_MAX = 20;

export const productSpecSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(400)
});
export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productImageSchema = z.object({
  src: localOrRemoteUrl.refine((value) => value.length > 0),
  alt: z.string().max(200),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable()
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const productSchema = z.object({
  id: z.number().int().positive(),
  slug: catalogSlug,
  categoryId: z.number().int().positive(),
  brandId: z.number().int().positive().nullable(),
  name: z.string().min(1).max(160),
  model: z.string().max(80),
  tagline: z.string().max(300),
  summary: z.string().max(1000),
  specs: z.array(productSpecSchema).max(PRODUCT_SPECS_MAX),
  description: z.string(),
  images: z.array(productImageSchema).max(PRODUCT_IMAGES_MAX),
  featured: z.boolean(),
  status: catalogStatusSchema,
  sort: z.number().int(),
  seo: catalogSeoSchema,
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Product = z.infer<typeof productSchema>;
export const productsFileSchema = z.array(productSchema);

export const redirectSchema = z.object({
  from: z.string().startsWith('/').max(500),
  to: z.string().startsWith('/').max(500)
});
export type Redirect = z.infer<typeof redirectSchema>;
export const redirectsFileSchema = z.array(redirectSchema);

export const officeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  country: z.string().min(1).max(80),
  role: z.string().max(120),
  address: z.string().max(300),
  poBox: z.string().max(80),
  phones: z.array(z.string().min(1).max(40)).max(8),
  fax: z.string().max(40),
  emails: z.array(z.email()).max(4),
  mapQuery: z.string().max(200).default(''),
  isPrimary: z.boolean(),
  sort: z.number().int()
});
export type Office = z.infer<typeof officeSchema>;
export const officesFileSchema = z.array(officeSchema);

export const settingsSchema = z.object({
  siteName: z.string().min(1).max(120),
  tagline: z.string().max(200),
  description: z.string().max(400),
  logo: localOrRemoteUrl,
  favicon: localOrRemoteUrl,
  contactEmail: z.email(),
  contactPhone: z.string().max(40),
  whatsappNumber: z.string().max(40).default(''),
  brochureUrl: z.string().max(500),
  footerText: z.string().max(400),
  copyright: z.string().max(200),
  inquiryTopics: z.array(z.string().min(1).max(80)).min(1).max(12),
  themeColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#0b3a5b'),
  social: z
    .object({
      facebook: z.string().max(500),
      instagram: z.string().max(500),
      linkedin: z.string().max(500),
      youtube: z.string().max(500)
    })
    .default({ facebook: '', instagram: '', linkedin: '', youtube: '' }),
  ctaBand: z
    .object({
      title: z.string().max(160),
      text: z.string().max(400),
      label: z.string().max(80)
    })
    .default({ title: '', text: '', label: '' }),
  thankYouMessage: z.string().max(400).default('Thank you. Your message has been received and our team will contact you shortly.'),
  seo: z.object({
    defaultTitle: z.string().max(200),
    defaultDescription: z.string().max(400),
    defaultKeywords: z.string().max(500),
    defaultImage: localOrRemoteUrl
  }),
  updatedAt: isoDate
});
export type Settings = z.infer<typeof settingsSchema>;

export const userRoleSchema = z.enum(['admin', 'editor']);
export type UserRole = z.infer<typeof userRoleSchema>;
export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  name: z.string().min(1).max(120),
  role: userRoleSchema,
  passwordHash: z.string().startsWith('scrypt$'),
  active: z.boolean(),
  lastLoginAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type User = z.infer<typeof userSchema>;
export type PublicUser = Omit<User, 'passwordHash'>;
export const usersFileSchema = z.array(userSchema);

export const submissionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.email(),
  company: z.string().max(160),
  phone: z.string().max(40),
  topic: z.string().max(80),
  productId: z.number().int().positive().nullable().default(null),
  productName: z.string().max(200).default(''),
  message: z.string().min(1).max(5000),
  ip: z.string().max(64),
  userAgent: z.string().max(400),
  emailed: z.boolean(),
  read: z.boolean(),
  createdAt: isoDate
});
export type Submission = z.infer<typeof submissionSchema>;
export const submissionsFileSchema = z.array(submissionSchema);
