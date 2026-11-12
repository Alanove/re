import { z } from 'zod';

const localOrRemoteUrl = z.string().max(2048);
const isoDate = z.iso.datetime();

/** URL segment: letters (Arabic or Latin, with their marks), digits, dash and underscore. Never a slash. */
export const SLUG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*$/u;
const slugField = z.string().min(1).max(120).regex(SLUG_PATTERN);
/** A full site path such as `/الرعية/أضواء`, built from slugs. */
export const sitePathSchema = z
  .string()
  .max(400)
  .refine((value) => value.startsWith('/') && value.split('/').slice(1).every((segment) => SLUG_PATTERN.test(segment)), {
    message: 'Use a path such as /section or /parent/section'
  });

export const directionSchema = z.enum(['auto', 'rtl', 'ltr']);
export type Direction = z.infer<typeof directionSchema>;

export const publishStatusSchema = z.enum(['published', 'draft']);
export type PublishStatus = z.infer<typeof publishStatusSchema>;
export const pageStatusSchema = publishStatusSchema;

/**
 * `section` lists child pages as cards. The remaining special kinds render a module at the page's address:
 * `library` the book catalogue, `hymns` the hymn player, `purchases` the books for sale,
 * `albums` the photo albums, `videos` the video library.
 */
export const pageKindSchema = z.enum(['page', 'section', 'contact', 'library', 'hymns', 'purchases', 'albums', 'videos']);
export type PageKind = z.infer<typeof pageKindSchema>;
export const SINGLETON_PAGE_KINDS: readonly PageKind[] = ['library', 'hymns', 'purchases', 'albums', 'videos'];

const seoSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(400),
  keywords: z.string().max(500)
});
export type Seo = z.infer<typeof seoSchema>;

export const pageSchema = z.object({
  id: z.number().int().positive(),
  key: slugField,
  parentId: z.number().int().positive().nullable(),
  slug: slugField,
  title: z.string().min(1).max(200),
  header: z.string().max(200),
  summary: z.string().max(2000),
  content: z.string(),
  status: publishStatusSchema,
  kind: pageKindSchema,
  direction: directionSchema.default('auto'),
  sort: z.number().int(),
  icon: z.string().max(60),
  heroImage: localOrRemoteUrl,
  heroVideo: localOrRemoteUrl.default(''),
  seo: seoSchema,
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

/** An article section (الكتاب المقدس, تعليم الكنيسة ...). Its articles live at `<path>/<article slug>`. */
export const sectionSchema = z.object({
  id: z.number().int().positive(),
  path: sitePathSchema,
  title: z.string().min(1).max(160),
  intro: z.string().max(2000),
  image: localOrRemoteUrl,
  status: publishStatusSchema,
  sort: z.number().int(),
  seo: seoSchema,
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Section = z.infer<typeof sectionSchema>;
export const sectionsFileSchema = z.array(sectionSchema);

export const imageRefSchema = z.object({
  src: localOrRemoteUrl,
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable()
});
export type ImageRef = z.infer<typeof imageRefSchema>;

export const articleSchema = z.object({
  id: z.number().int().positive(),
  /** Page id on the legacy CMS, kept to map hashtags and legacy links. */
  legacyId: z.number().int().positive().nullable(),
  sectionId: z.number().int().positive(),
  slug: slugField,
  title: z.string().min(1).max(250),
  summary: z.string().max(2000),
  content: z.string(),
  image: imageRefSchema.nullable(),
  direction: directionSchema,
  tags: z.array(z.string().min(1).max(80)).max(30),
  status: publishStatusSchema,
  /** Sort date. Imported articles get one derived from the legacy order and keep `dateKnown: false`, so no date is shown. */
  publishedAt: isoDate,
  dateKnown: z.boolean().default(true),
  seo: seoSchema,
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Article = z.infer<typeof articleSchema>;

export const bookSchema = z.object({
  id: z.number().int().positive(),
  legacyId: z.number().int().positive().nullable(),
  title: z.string().min(1).max(300),
  author: z.string().max(300),
  publisher: z.string().max(300),
  language: z.string().max(80),
  genre: z.string().max(120),
  subject: z.string().max(300),
  format: z.string().max(80),
  year: z.string().max(20),
  pageCount: z.number().int().nonnegative().nullable(),
  notes: z.string().max(2000),
  active: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Book = z.infer<typeof bookSchema>;
export const booksFileSchema = z.array(bookSchema);

export const hymnSchema = z.object({
  id: z.number().int().positive(),
  legacyId: z.number().int().positive().nullable(),
  title: z.string().min(1).max(250),
  file: z.string().max(2048),
  singer: z.string().max(250),
  author: z.string().max(250),
  album: z.string().max(250),
  category: z.string().max(160),
  sort: z.number().int(),
  active: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Hymn = z.infer<typeof hymnSchema>;
export const hymnsFileSchema = z.array(hymnSchema);

export const albumImageSchema = imageRefSchema.extend({ caption: z.string().max(300) });
export type AlbumImage = z.infer<typeof albumImageSchema>;

export const albumSchema = z.object({
  id: z.number().int().positive(),
  legacyId: z.number().int().positive().nullable(),
  slug: slugField,
  title: z.string().min(1).max(200),
  summary: z.string().max(1000),
  images: z.array(albumImageSchema).max(500),
  status: publishStatusSchema,
  sort: z.number().int(),
  publishedAt: isoDate,
  dateKnown: z.boolean().default(true),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Album = z.infer<typeof albumSchema>;
export const albumsFileSchema = z.array(albumSchema);

export const videoSchema = z.object({
  id: z.number().int().positive(),
  slug: slugField,
  title: z.string().min(1).max(200),
  summary: z.string().max(1000),
  youtubeId: z.string().regex(/^[\w-]{6,20}$/),
  image: imageRefSchema.nullable(),
  direction: directionSchema,
  status: publishStatusSchema,
  sort: z.number().int(),
  publishedAt: isoDate,
  dateKnown: z.boolean().default(true),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Video = z.infer<typeof videoSchema>;
export const videosFileSchema = z.array(videoSchema);

/** A book or item sold by the centre (مشتريات). */
export const purchaseSchema = z.object({
  id: z.number().int().positive(),
  legacyId: z.number().int().positive().nullable(),
  category: z.string().min(1).max(120),
  slug: slugField,
  title: z.string().min(1).max(250),
  author: z.string().max(250),
  price: z.string().max(60),
  summary: z.string().max(2000),
  content: z.string(),
  image: imageRefSchema.nullable(),
  status: publishStatusSchema,
  sort: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export type Purchase = z.infer<typeof purchaseSchema>;
export const purchasesFileSchema = z.array(purchaseSchema);

export const subscriberSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  ip: z.string().max(64),
  createdAt: isoDate
});
export type Subscriber = z.infer<typeof subscriberSchema>;
export const subscribersFileSchema = z.array(subscriberSchema);

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

export const HOME_LIST_MAX = 12;
export const HOME_SECTIONS_MAX = 12;

const homeListSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(120),
  count: z.number().int().min(1).max(HOME_LIST_MAX)
});

export const homeSchema = z.object({
  /** Lead story plus cards from one section (أضواء on the legacy site). */
  spotlight: homeListSchema.extend({ sectionId: z.number().int().positive().nullable() }),
  /** Grid of sections with their latest articles. */
  sections: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    sectionIds: z.array(z.number().int().positive()).max(HOME_SECTIONS_MAX),
    count: z.number().int().min(1).max(6)
  }),
  /** Question-and-answer strip (سؤال الى الكاهن). */
  questions: homeListSchema.extend({ sectionId: z.number().int().positive().nullable(), intro: z.string().max(400) }),
  hymns: homeListSchema.extend({ intro: z.string().max(400) }),
  videos: homeListSchema,
  albums: homeListSchema,
  newsletter: z.object({
    enabled: z.boolean(),
    title: z.string().max(160),
    text: z.string().max(400)
  }),
  updatedAt: isoDate
});
export type Home = z.infer<typeof homeSchema>;
export const homeSectionKeys = ['spotlight', 'sections', 'questions', 'hymns', 'videos', 'albums', 'newsletter'] as const;
export type HomeSectionKey = (typeof homeSectionKeys)[number];

export const redirectSchema = z.object({
  from: z.string().startsWith('/').max(500),
  to: z.string().startsWith('/').max(500)
});
export type Redirect = z.infer<typeof redirectSchema>;
export const redirectsFileSchema = z.array(redirectSchema);

export const settingsSchema = z.object({
  siteName: z.string().min(1).max(120),
  tagline: z.string().max(200),
  description: z.string().max(400),
  logo: localOrRemoteUrl,
  emblem: localOrRemoteUrl.default(''),
  favicon: localOrRemoteUrl,
  contactEmail: z.email(),
  contactPhone: z.string().max(40),
  address: z.string().max(300).default(''),
  mapQuery: z.string().max(200).default(''),
  footerText: z.string().max(400),
  copyright: z.string().max(200),
  inquiryTopics: z.array(z.string().min(1).max(80)).min(1).max(12),
  themeColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#007d90'),
  social: z
    .object({
      facebook: z.string().max(500),
      x: z.string().max(500),
      instagram: z.string().max(500),
      youtube: z.string().max(500)
    })
    .default({ facebook: '', x: '', instagram: '', youtube: '' }),
  /** Sister sites shown in the footer (church, youth ...). */
  relatedLinks: z.array(z.object({ label: z.string().min(1).max(80), url: z.string().max(500) })).max(8).default([]),
  thankYouMessage: z.string().max(400),
  newsletterThankYou: z.string().max(400),
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

export const submissionTypes = ['contact', 'purchase'] as const;
export const submissionTypeSchema = z.enum(submissionTypes);
export type SubmissionType = z.infer<typeof submissionTypeSchema>;

export const submissionSchema = z.object({
  id: z.uuid(),
  type: submissionTypeSchema.default('contact'),
  name: z.string().min(1).max(120),
  email: z.email(),
  phone: z.string().max(40),
  topic: z.string().max(80),
  purchaseId: z.number().int().positive().nullable().default(null),
  purchaseTitle: z.string().max(250).default(''),
  message: z.string().min(1).max(5000),
  ip: z.string().max(64),
  userAgent: z.string().max(400),
  emailed: z.boolean(),
  read: z.boolean(),
  createdAt: isoDate
});
export type Submission = z.infer<typeof submissionSchema>;
export const submissionsFileSchema = z.array(submissionSchema);
