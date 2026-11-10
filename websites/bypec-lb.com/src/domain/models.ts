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

export const HERO_TILES_MAX = 6;
export const SERVICES_MAX = 6;
export const TESTIMONIALS_MAX = 10;

export const stationTileSchema = z.object({
  title: z.string().min(1).max(80),
  url: z.string().max(500),
  image: localOrRemoteUrl
});
export type StationTile = z.infer<typeof stationTileSchema>;

export const serviceItemSchema = z.object({
  title: z.string().min(1).max(120),
  text: z.string().max(800),
  image: localOrRemoteUrl,
  url: z.string().max(500)
});
export type ServiceItem = z.infer<typeof serviceItemSchema>;

export const testimonialSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(120),
  quote: z.string().max(1200),
  photo: localOrRemoteUrl
});
export type Testimonial = z.infer<typeof testimonialSchema>;

export const homeSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    eyebrow: z.string().max(120),
    title: z.string().max(160),
    intro: z.string().max(400),
    image: localOrRemoteUrl,
    tiles: z.array(stationTileSchema).max(HERO_TILES_MAX)
  }),
  about: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    heading: z.string().max(160),
    content: z.string().max(20_000),
    image: localOrRemoteUrl,
    cta: linkSchema
  }),
  prices: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400)
  }),
  testimonials: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    video: localOrRemoteUrl,
    image: localOrRemoteUrl,
    items: z.array(testimonialSchema).max(TESTIMONIALS_MAX)
  }),
  services: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    items: z.array(serviceItemSchema).max(SERVICES_MAX)
  }),
  updatedAt: isoDate
});
export type Home = z.infer<typeof homeSchema>;
export const homeSectionKeys = ['hero', 'about', 'prices', 'testimonials', 'services'] as const;
export type HomeSectionKey = (typeof homeSectionKeys)[number];

export const fuelProductKeys = ['unleaded98', 'unleaded95', 'dieselVehicle', 'mazout', 'kerosene'] as const;
export const fuelProductKeySchema = z.enum(fuelProductKeys);
export type FuelProductKey = z.infer<typeof fuelProductKeySchema>;
export const FUEL_PRICE_HISTORY_MAX = 30;
const calendarDate = z.iso.date();
const lbpPrice = z.number().int().positive().max(1_000_000_000);

export const fuelProductSchema = z.object({
  key: fuelProductKeySchema,
  label: z.string().min(1).max(60),
  officialPrice: lbpPrice.nullable(),
  override: lbpPrice.nullable(),
  overrideUpdatedAt: isoDate.nullable(),
  visible: z.boolean(),
  sort: z.number().int()
});
export type FuelProduct = z.infer<typeof fuelProductSchema>;

export const fuelPriceDecisionSchema = z.object({
  officialDate: calendarDate.nullable(),
  fetchedAt: isoDate,
  prices: z.partialRecord(fuelProductKeySchema, lbpPrice)
});
export type FuelPriceDecision = z.infer<typeof fuelPriceDecisionSchema>;

export const fuelPricesSchema = z.object({
  unit: z.string().min(1).max(40),
  sync: z.object({
    enabled: z.boolean(),
    officialDate: calendarDate.nullable(),
    lastAttemptAt: isoDate.nullable(),
    lastSuccessAt: isoDate.nullable(),
    lastChangeAt: isoDate.nullable(),
    lastError: z.string().max(500)
  }),
  products: z.array(fuelProductSchema).max(fuelProductKeys.length),
  history: z.array(fuelPriceDecisionSchema).max(FUEL_PRICE_HISTORY_MAX),
  updatedAt: isoDate
});
export type FuelPrices = z.infer<typeof fuelPricesSchema>;

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
