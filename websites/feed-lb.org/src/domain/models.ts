import { z } from 'zod';

const localOrRemoteUrl = z.string().max(2048);
const isoDate = z.iso.datetime();

export const pageStatusSchema = z.enum(['published', 'draft']);
/** `news` lists its child stories, `donations` shows the pledge form, `partners` the partner logo wall. */
export const pageKindSchema = z.enum(['page', 'section', 'contact', 'news', 'donations', 'partners', 'footer']);
export type PageKind = z.infer<typeof pageKindSchema>;

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

export const HERO_SLIDES_MAX = 8;
export const HOME_LIST_MAX = 12;

export const heroSlideSchema = z.object({
  title: z.string().min(1).max(120),
  text: z.string().max(300),
  url: z.string().max(500),
  label: z.string().max(60),
  image: localOrRemoteUrl
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

const pageKeyRef = z.string().max(120);

/** A home strip that lists the published child pages of one page (programs, about, executive team). */
const pageListSectionSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(120),
  intro: z.string().max(400),
  sourceKey: pageKeyRef,
  count: z.number().int().min(1).max(HOME_LIST_MAX)
});

export const homeSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    interval: z.number().int().min(3).max(30),
    slides: z.array(heroSlideSchema).max(HERO_SLIDES_MAX)
  }),
  programs: pageListSectionSchema,
  about: pageListSectionSchema,
  news: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    count: z.number().int().min(1).max(HOME_LIST_MAX)
  }),
  team: pageListSectionSchema,
  partners: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400)
  }),
  donate: z.object({
    enabled: z.boolean(),
    title: z.string().max(160),
    text: z.string().max(400),
    label: z.string().max(80),
    image: localOrRemoteUrl
  }),
  updatedAt: isoDate
});
export type Home = z.infer<typeof homeSchema>;
export const homeSectionKeys = ['hero', 'programs', 'about', 'news', 'team', 'partners', 'donate'] as const;
export type HomeSectionKey = (typeof homeSectionKeys)[number];
export const homeListSectionKeys = ['programs', 'about', 'team'] as const;
export type HomeListSectionKey = (typeof homeListSectionKeys)[number];

export const partnerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(160),
  website: z.string().max(500),
  logo: localOrRemoteUrl,
  logoWidth: z.number().int().nonnegative().nullable().default(null),
  logoHeight: z.number().int().nonnegative().nullable().default(null),
  active: z.boolean(),
  sort: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Partner = z.infer<typeof partnerSchema>;
export const partnersFileSchema = z.array(partnerSchema);

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

export const donationCurrencies = ['USD', 'LBP'] as const;
export const donationCurrencySchema = z.enum(donationCurrencies);
export type DonationCurrency = z.infer<typeof donationCurrencySchema>;
export const donationFrequencies = ['one-time', 'monthly'] as const;
export const donationFrequencySchema = z.enum(donationFrequencies);
export type DonationFrequency = z.infer<typeof donationFrequencySchema>;
export const DONATION_PRESETS_MAX = 6;
export const DONATION_CAUSES_MAX = 12;

export const donationSettingsSchema = z.object({
  /** Bank transfer and other offline giving details, one line each. */
  bankDetails: z.array(z.string().min(1).max(160)).max(12),
  presetAmounts: z.array(z.number().int().positive().max(1_000_000)).max(DONATION_PRESETS_MAX),
  causes: z.array(z.string().min(1).max(120)).min(1).max(DONATION_CAUSES_MAX),
  thankYouMessage: z.string().min(1).max(400)
});
export type DonationSettings = z.infer<typeof donationSettingsSchema>;

export function defaultDonationSettings(): DonationSettings {
  return {
    bankDetails: [],
    presetAmounts: [10, 25, 50, 100],
    causes: ['Where it is needed most'],
    thankYouMessage: 'Thank you for your generosity. Our team will contact you shortly to arrange your donation.'
  };
}

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
  donation: donationSettingsSchema.default(defaultDonationSettings),
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

export const submissionTypes = ['contact', 'donation'] as const;
export const submissionTypeSchema = z.enum(submissionTypes);
export type SubmissionType = z.infer<typeof submissionTypeSchema>;

export const donationPledgeSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000),
  currency: donationCurrencySchema,
  frequency: donationFrequencySchema,
  cause: z.string().max(120)
});
export type DonationPledge = z.infer<typeof donationPledgeSchema>;

export const submissionSchema = z.object({
  id: z.string().uuid(),
  type: submissionTypeSchema.default('contact'),
  donation: donationPledgeSchema.nullable().default(null),
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
