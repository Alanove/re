import { z } from 'zod';

const localOrRemoteUrl = z.string().max(2048);
const isoDate = z.iso.datetime();
const calendarDate = z.iso.date();

export const pageStatusSchema = z.enum(['published', 'draft']);
/** `news` and `events` roots list their child entries; the `videos` page lists the YouTube library. */
export const pageKindSchema = z.enum(['page', 'section', 'news', 'events', 'videos']);
export type PageKind = z.infer<typeof pageKindSchema>;
export const collectionKindSchema = z.enum(['news', 'events']);
export type CollectionKind = z.infer<typeof collectionKindSchema>;
export const textDirectionSchema = z.enum(['auto', 'rtl', 'ltr']);
export type TextDirection = z.infer<typeof textDirectionSchema>;

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
  direction: textDirectionSchema.default('auto'),
  sort: z.number().int(),
  heroImage: localOrRemoteUrl,
  heroVideo: localOrRemoteUrl.default(''),
  eventDate: z.union([calendarDate, z.literal('')]).default(''),
  venue: z.string().max(200).default(''),
  linkUrl: z.string().max(500).default(''),
  linkLabel: z.string().max(80).default(''),
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

export const QUOTES_MAX = 10;
export const HOME_LIST_MAX = 12;
export const HERO_SLIDES_MAX = 8;
export const HERO_INTERVAL_DEFAULT = 7;
export const heroFocusSchema = z.enum(['left', 'center', 'right']);
export type HeroFocus = z.infer<typeof heroFocusSchema>;
/** Where the name and intro sit over the slides from tablet width up; phones always place them at the bottom. */
export const heroTextSideSchema = z.enum(['left', 'right', 'bottom']);

/** A slide shows its photo, or plays its video muted with the photo as poster. */
export const heroSlideSchema = z.object({
  image: localOrRemoteUrl,
  video: localOrRemoteUrl,
  focus: heroFocusSchema,
  caption: z.string().max(160)
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

/** Earlier data stored a single `image` + `focus`; it becomes the first slide. */
function migrateHero(value: unknown): unknown {
  if (!value || typeof value !== 'object' || 'slides' in value) {
    return value;
  }
  const { image, focus, ...rest } = value as Record<string, unknown>;
  const side = focus === 'left' ? 'right' : focus === 'right' ? 'left' : 'bottom';
  return {
    ...rest,
    textSide: side,
    interval: HERO_INTERVAL_DEFAULT,
    slides: typeof image === 'string' && image !== '' ? [{ image, video: '', focus: focus ?? 'center', caption: '' }] : []
  };
}

export const quoteSchema = z.object({
  quote: z.string().min(1).max(1200),
  author: z.string().min(1).max(120),
  role: z.string().max(160)
});
export type Quote = z.infer<typeof quoteSchema>;

const listSectionSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(120),
  intro: z.string().max(400),
  count: z.number().int().min(1).max(HOME_LIST_MAX)
});

export const homeSchema = z.object({
  hero: z.preprocess(
    migrateHero,
    z.object({
      enabled: z.boolean(),
      eyebrow: z.string().max(120),
      title: z.string().max(160),
      intro: z.string().max(400),
      textSide: heroTextSideSchema,
      interval: z.number().int().min(3).max(30),
      slides: z.array(heroSlideSchema).max(HERO_SLIDES_MAX),
      cta: linkSchema
    })
  ),
  upcoming: listSectionSchema.default({ enabled: true, title: 'Upcoming concerts', intro: '', count: 3 }),
  videos: listSectionSchema,
  about: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    heading: z.string().max(160),
    content: z.string().max(20_000),
    image: localOrRemoteUrl,
    cta: linkSchema
  }),
  quotes: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    image: localOrRemoteUrl,
    items: z.array(quoteSchema).max(QUOTES_MAX)
  }),
  events: listSectionSchema,
  news: listSectionSchema,
  updatedAt: isoDate
});
export type Home = z.infer<typeof homeSchema>;
export const homeSectionKeys = ['hero', 'upcoming', 'videos', 'about', 'quotes', 'events', 'news'] as const;
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
  favicon: localOrRemoteUrl,
  footerText: z.string().max(400),
  copyright: z.string().max(200),
  themeColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#0d0b0a'),
  seo: z.object({
    defaultTitle: z.string().max(200),
    defaultDescription: z.string().max(400),
    defaultKeywords: z.string().max(500),
    defaultImage: localOrRemoteUrl
  }),
  updatedAt: isoDate
});
export type Settings = z.infer<typeof settingsSchema>;

export const socialNetworkKeys = ['instagram', 'facebook', 'youtube', 'tiktok', 'x', 'spotify', 'anghami', 'appleMusic', 'deezer'] as const;
export const socialNetworkKeySchema = z.enum(socialNetworkKeys);
export type SocialNetworkKey = z.infer<typeof socialNetworkKeySchema>;
export const INSTAGRAM_POSTS_MAX = 12;
/** Instagram post and reel shortcodes, as they appear in https://www.instagram.com/p/<code>/. */
export const instagramCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{5,40}$/);

export const instagramPostSchema = z.object({
  code: instagramCodeSchema,
  kind: z.enum(['p', 'reel']),
  addedAt: isoDate
});
export type InstagramPost = z.infer<typeof instagramPostSchema>;

export const socialSchema = z.object({
  profiles: z.record(socialNetworkKeySchema, z.string().max(500)),
  instagram: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    intro: z.string().max(400),
    posts: z.array(instagramPostSchema).max(INSTAGRAM_POSTS_MAX)
  }),
  updatedAt: isoDate
});
export type Social = z.infer<typeof socialSchema>;

export const VIDEOS_MAX = 200;
export const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const youtubeChannelIdSchema = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);

export const videoSchema = z.object({
  id: youtubeIdSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(600),
  publishedAt: isoDate.nullable(),
  source: z.enum(['feed', 'manual']),
  pinned: z.boolean(),
  hidden: z.boolean(),
  sort: z.number().int(),
  addedAt: isoDate
});
export type Video = z.infer<typeof videoSchema>;

export const videoLibrarySchema = z.object({
  channelId: z.union([youtubeChannelIdSchema, z.literal('')]),
  sync: z.object({
    enabled: z.boolean(),
    lastAttemptAt: isoDate.nullable(),
    lastSuccessAt: isoDate.nullable(),
    lastChangeAt: isoDate.nullable(),
    lastError: z.string().max(500),
    lastCount: z.number().int().nonnegative()
  }),
  items: z.array(videoSchema).max(VIDEOS_MAX),
  updatedAt: isoDate
});
export type VideoLibrary = z.infer<typeof videoLibrarySchema>;

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
