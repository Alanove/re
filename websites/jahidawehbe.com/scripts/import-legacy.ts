import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite, type TransformConfig } from '../src/config/transform.js';
import { defaultHome, defaultSettings, defaultVideoLibrary, emptySocialProfiles } from '../src/domain/defaults.js';
import {
  HERO_SLIDES_MAX,
  HOME_LIST_MAX,
  QUOTES_MAX,
  heroFocusSchema,
  heroTextSideSchema,
  homeSchema,
  menusFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  redirectsFileSchema,
  settingsSchema,
  socialNetworkKeySchema,
  socialSchema,
  textDirectionSchema,
  videoLibrarySchema,
  type Home,
  type Menu,
  type MenuItem,
  type Page,
  type PageImage,
  type PageKind,
  type Settings,
  type Social,
  type TextDirection,
  type Video,
  type VideoLibrary
} from '../src/domain/models.js';
import { youtubeFeedSource } from '../src/repositories/youtubeFeedSource.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { excerpt, sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import { parseInstagramUrl } from '../src/services/socialService.js';
import { parseYoutubeId } from '../src/services/videoEmbedService.js';
import { AssetCollector, assetCropSchema, readAssetManifest, writeAssetManifest } from './lib/asset-manifest.js';
import { arabicShare, extractContentImages, extractLeadingLink, parseQuotes, plainText } from './lib/legacy-content.js';
import { normalizeLegacyHtml } from './lib/normalize-legacy-html.js';

const SUMMARY_LENGTH = 240;
const RTL_THRESHOLD = 0.6;
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);
const ROOT_PARENT = -1;
const ROUTE_ONLY_STATUS = 3;

const nullableString = z.string().nullable().catch(null);
const nullableNumber = z.number().nullable().catch(null);

const legacyPageRowSchema = z.object({
  PageId: z.number().int().positive(),
  ParentId: z.number().int(),
  URL: z.string().min(1),
  Title: z.string(),
  Header: nullableString,
  SmallDescription: nullableString,
  PageContent: nullableString,
  Status: z.number().int().catch(0),
  Image: nullableString,
  DateCreated: nullableNumber,
  DateModified: nullableNumber,
  PublishDate: nullableNumber,
  Keywords: nullableString
});
type LegacyPageRow = z.infer<typeof legacyPageRowSchema>;

const legacyPageImageRowSchema = z.object({
  ImageId: z.number().int().positive(),
  PageId: z.number().int().positive(),
  Sort: z.number().int().catch(0),
  Caption: nullableString,
  FileName: z.string().min(1),
  DateAdded: nullableNumber
});

const seedLinkSchema = z.object({ label: z.string(), url: z.string() });
const seedMenuItemSchema = z.object({ title: z.string().min(1), url: z.string().min(1) });
const seedListSchema = z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), count: z.number().int().min(1).max(HOME_LIST_MAX) });
const seedSchema = z.object({
  settings: z.object({
    tagline: z.string(),
    description: z.string(),
    favicon: z.string(),
    faviconCrop: assetCropSchema.nullable().default(null),
    footerText: z.string(),
    copyright: z.string(),
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    seo: z.object({ defaultTitle: z.string(), defaultDescription: z.string(), defaultKeywords: z.string(), defaultImage: z.string() })
  }),
  /** Legacy pages that only wrapped one YouTube video; they become library videos and redirect to the videos page. */
  videoPages: z.array(z.number().int().positive()),
  /** Overrides keyed by legacy PageId. Pages with Arabic URLs need an English slug here. */
  pages: z.record(
    z.string().regex(/^\d+$/),
    z.object({
      title: z.string().min(1).optional(),
      header: z.string().optional(),
      slug: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).optional(),
      summary: z.string().max(400).optional(),
      direction: textDirectionSchema.optional(),
      linkLabel: z.string().max(80).optional(),
      status: z.enum(['published', 'draft']).optional(),
      sort: z.number().int().optional()
    })
  ),
  redirects: z.array(z.object({ from: z.string().startsWith('/'), to: z.string().startsWith('/') })),
  menus: z.object({ main: z.array(seedMenuItemSchema).min(1), footer: z.array(seedMenuItemSchema) }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean(),
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      textSide: heroTextSideSchema,
      interval: z.number().int().min(3).max(30),
      slides: z.array(z.object({ image: z.string(), video: z.string().optional(), focus: heroFocusSchema, caption: z.string() })).max(HERO_SLIDES_MAX),
      cta: seedLinkSchema
    }),
    upcoming: seedListSchema,
    videos: seedListSchema,
    about: z.object({ enabled: z.boolean(), title: z.string(), heading: z.string(), source: z.number().int().positive(), image: z.string(), cta: seedLinkSchema }),
    quotes: z.object({ enabled: z.boolean(), title: z.string(), source: z.number().int().positive(), image: z.string() }),
    events: seedListSchema,
    news: seedListSchema
  }),
  social: z.object({
    profiles: z.partialRecord(socialNetworkKeySchema, z.url()),
    instagram: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), posts: z.array(z.url()) }),
    facebook: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string() })
  })
});
type Seed = z.infer<typeof seedSchema>;

interface ImportContext {
  config: TransformConfig;
  legacyHost: string;
  assets: AssetCollector;
  /** New URL of every imported page by its legacy URL key (lowercase, as typed in the old CMS). */
  urlByLegacyKey: Map<string, string>;
  urlById: Map<number, string>;
}

function excelDateToIso(serial: number | null, fallback: string): string {
  if (serial === null || !Number.isFinite(serial)) {
    return fallback;
  }
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString();
}

function excelDateToCalendar(serial: number | null): string {
  return serial === null || !Number.isFinite(serial) ? '' : excelDateToIso(serial, '').slice(0, 10);
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePathSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
    .join('/');
}

function normalizeLegacyPath(legacyPath: string): string {
  return path.posix.normalize(`/${decodeURIComponentSafe(legacyPath).replace(/^\/+/, '')}`);
}

/** Local mirror path: ASCII file names stay readable, others (Arabic) fall back to a stable slug with the legacy number. */
function mirrorPath(context: ImportContext, normalized: string, extension: string): string {
  const parsed = path.posix.parse(normalized);
  const readable = slugify(parsed.name);
  const digits = /\d{5,}/.exec(parsed.name)?.[0] ?? '';
  const name = readable.length >= 3 && arabicShare(parsed.name) === 0 ? readable : `image-${digits || readable || 'file'}`;
  return `${context.config.legacy.uploadsMirrorPrefix}${encodePathSegments(path.posix.join(parsed.dir, `${name}${extension}`)).toLowerCase()}`;
}

function legacyAsset(context: ImportContext, legacyPath: string, preset: ImagePreset | null, fallbacks: string[] = [], crop: z.infer<typeof assetCropSchema> | null = null): string {
  const normalized = normalizeLegacyPath(legacyPath);
  const extension = preset === null ? path.posix.extname(normalized).toLowerCase() : preset === 'favicon' ? '.png' : '.webp';
  return context.assets.add(mirrorPath(context, normalized, extension), [normalized, ...fallbacks.map(normalizeLegacyPath)], preset, crop);
}

function pageImagePath(context: ImportContext, pageId: number, fileName: string): string {
  return context.config.legacy.pageImagePattern.replace('{pageId}', String(pageId)).replace('{fileName}', fileName);
}

function legacyPageImage(context: ImportContext, row: LegacyPageRow, preset: ImagePreset): string {
  const image = row.Image?.trim();
  if (!image) {
    return '';
  }
  const parsed = path.posix.parse(image);
  return legacyAsset(context, pageImagePath(context, row.PageId, image), preset, [
    pageImagePath(context, row.PageId, `${parsed.name}-l${parsed.ext}`),
    pageImagePath(context, row.PageId, `${parsed.name}-m${parsed.ext}`)
  ]);
}

function resolveSeedValue(context: ImportContext, value: string, preset: ImagePreset | null): string {
  if (value.startsWith('legacy:')) {
    const legacyPath = value.slice('legacy:'.length);
    const extension = path.posix.extname(legacyPath).toLowerCase();
    return legacyAsset(context, legacyPath, VIDEO_EXTENSIONS.has(extension) || DOCUMENT_EXTENSIONS.has(extension) ? null : preset);
  }
  if (value.startsWith('page:')) {
    const [id, hash] = value.slice('page:'.length).split('#');
    const url = context.urlById.get(Number(id));
    if (!url) {
      throw new Error(`Seed references unknown page id "${id ?? ''}"`);
    }
    return hash ? `${url}#${hash}` : url;
  }
  return value;
}

function rewriteLegacyUrl(context: ImportContext, rawValue: string): string {
  const value = rawValue.trim().replace(/&amp;/g, '&');
  if (value === '' || value.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(value)) {
    return rawValue;
  }
  const hostPattern = new RegExp(`^(?:https?:)?//(?:www\\.)?${context.legacyHost.replace(/\./g, '\\.')}(?=/|$|\\?|#)`, 'i');
  let remainder: string;
  if (hostPattern.test(value)) {
    remainder = value.replace(hostPattern, '');
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
    return rawValue;
  } else {
    remainder = value;
  }
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(remainder);
  const pathname = path.posix.normalize(`/${(match?.[1] ?? '').replace(/^\/+/, '')}`);
  const hash = match?.[3] ?? '';
  if (pathname === '/' || pathname === '/.') {
    return `/${hash}`;
  }
  const extension = path.posix.extname(pathname).toLowerCase();
  if (RASTER_EXTENSIONS.has(extension)) {
    return legacyAsset(context, pathname, 'content');
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return legacyAsset(context, pathname, null);
  }
  const lastSegment = decodeURIComponentSafe(pathname.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  const target = context.urlByLegacyKey.get(lastSegment);
  return `${target ?? pathname}${hash}`;
}

function rewriteUrls(context: ImportContext, html: string): string {
  const rewritten = html.replace(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi, (_whole, attribute: string, quote: string, value: string) => {
    return `${attribute}=${quote}${rewriteLegacyUrl(context, value)}${quote}`;
  });
  return sanitizeRichText(rewritten);
}

/** The old editor double-encoded ampersands ("&amp;amp;") and padded bodies with empty paragraphs. */
function cleanLegacyHtml(html: string): string {
  return html.replace(/&amp;amp;/g, '&amp;');
}

function finalizeHtml(html: string): string {
  return sanitizeRichText(normalizeLegacyHtml(sanitizeRichText(html)));
}

function cleanTitle(value: string): string {
  return plainText(value.replace(/&amp;amp;/g, '&amp;'));
}

function readSheet<T>(workbook: XLSX.WorkBook, name: string, schema: z.ZodType<T>): T[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(`Workbook is missing the "${name}" sheet`);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Invalid ${name} row ${index + 2}: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  });
}

function legacyKey(row: LegacyPageRow): string {
  return row.URL.trim().toLowerCase();
}

function rootKind(config: TransformConfig, key: string): PageKind | null {
  if (key === config.collections.newsRootKey) {
    return 'news';
  }
  if (key === config.collections.eventsRootKey) {
    return 'events';
  }
  return key === config.videos.rootKey ? 'videos' : null;
}

function detectDirection(text: string): TextDirection {
  return arabicShare(text) >= RTL_THRESHOLD ? 'rtl' : 'auto';
}

function buildPages(context: ImportContext, rows: LegacyPageRow[], seed: Seed, now: string): Page[] {
  const ordered = [...rows].sort((a, b) => a.PageId - b.PageId);
  const takenSlugs = new Map<number | null, Set<string>>();
  const takenKeys = new Set<string>();
  const parentIds = new Set(rows.map((row) => row.ParentId));
  const kindById = new Map(rows.map((row) => [row.PageId, rootKind(context.config, legacyKey(row))]));
  return ordered.map((row, index) => {
    const key = legacyKey(row);
    const override = seed.pages[String(row.PageId)] ?? {};
    const root = kindById.get(row.PageId) ?? null;
    const parentKind = row.ParentId === ROOT_PARENT ? null : (kindById.get(row.ParentId) ?? null);
    const isEntry = parentKind === 'news' || parentKind === 'events';
    const isSection = root === null && row.Status === ROUTE_ONLY_STATUS && parentIds.has(row.PageId);
    const parentId = row.ParentId === ROOT_PARENT ? null : row.ParentId;

    const leading = isEntry ? extractLeadingLink(cleanLegacyHtml(row.PageContent ?? '')) : { html: cleanLegacyHtml(row.PageContent ?? ''), url: '' };
    const content = root === null ? leading.html : '';
    const title = cleanTitle(override.title ?? row.Title);
    const header = cleanTitle(override.header ?? row.Header ?? '') || title;
    const direction = override.direction ?? detectDirection(`${title} ${toPlainText(content)}`);
    const smallDescription = cleanTitle(row.SmallDescription ?? '');
    const summary = override.summary ?? (smallDescription && !/^https?:\/\//i.test(smallDescription) ? excerpt(smallDescription, SUMMARY_LENGTH) : excerpt(content, SUMMARY_LENGTH));
    const linkUrl = leading.url;
    const linkLabel = linkUrl ? (override.linkLabel ?? (direction === 'rtl' ? 'اقرأ المقال الأصلي' : 'Read the original article')) : '';
    const createdAt = excelDateToIso(isEntry ? (row.PublishDate ?? row.DateCreated) : row.DateCreated, now);

    const taken = takenSlugs.get(parentId) ?? new Set<string>();
    takenSlugs.set(parentId, taken);
    const base = override.slug ?? (slugify(key.replace(/_\d+$/, '')) || slugify(title) || `page-${row.PageId}`);
    let slug = base;
    for (let counter = 2; taken.has(slug); counter += 1) {
      slug = `${base}-${counter}`;
    }
    taken.add(slug);
    const baseKey = /^[a-z0-9][a-z0-9_-]*$/.test(key) ? key : slug;
    let pageKey = baseKey;
    for (let counter = 2; takenKeys.has(pageKey); counter += 1) {
      pageKey = `${baseKey}-${counter}`;
    }
    takenKeys.add(pageKey);

    const status = override.status ?? (row.Status > 0 ? 'published' : 'draft');
    const isEmpty = toPlainText(content) === '' && !/<(img|iframe)\b/i.test(content) && linkUrl === '';
    return {
      id: row.PageId,
      key: pageKey,
      parentId,
      slug,
      title,
      header,
      summary,
      content,
      status: status === 'published' && root === null && !isSection && isEmpty ? 'draft' : status,
      kind: root ?? (isSection ? 'section' : 'page'),
      direction,
      sort: override.sort ?? (index + 1) * 10,
      heroImage: legacyPageImage(context, row, 'hero'),
      heroVideo: '',
      eventDate: parentKind === 'events' ? excelDateToCalendar(row.PublishDate ?? row.DateCreated) : '',
      venue: '',
      linkUrl,
      linkLabel,
      seo: { title: '', description: summary.slice(0, 400), keywords: (row.Keywords ?? '').trim().slice(0, 500) },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    };
  });
}

/** Inline images in legacy bodies (mostly hot-linked from press sites) move to each page's photo gallery. */
function moveContentImagesToGallery(context: ImportContext, pages: Page[], now: string, startId: number): { pages: Page[]; images: PageImage[] } {
  const images: PageImage[] = [];
  const updated = pages.map((page) => {
    const { html, sources } = extractContentImages(page.content);
    const local = sources.filter((source) => !/^(?:https?:)?\/\//i.test(source) || new RegExp(context.legacyHost.replace(/\./g, '\\.'), 'i').test(source));
    if (local.length === 0) {
      return page;
    }
    local.forEach((source, index) => {
      images.push({
        id: startId + images.length,
        pageId: page.id,
        sort: 1000 + (index + 1) * 10,
        caption: '',
        src: legacyAsset(context, source.replace(/^(?:https?:)?\/\/[^/]+/i, ''), 'gallery'),
        width: null,
        height: null,
        createdAt: now
      });
    });
    return { ...page, content: local.length === sources.length ? html : page.content };
  });
  return { pages: updated, images };
}

function buildGallery(context: ImportContext, workbook: XLSX.WorkBook, pageIds: Set<number>, now: string): PageImage[] {
  const pattern = context.config.legacy.galleryImagePattern;
  return readSheet(workbook, 'PageImages', legacyPageImageRowSchema)
    .filter((row) => pageIds.has(row.PageId))
    .sort((a, b) => a.PageId - b.PageId || a.Sort - b.Sort || a.ImageId - b.ImageId)
    .map((row, index) => {
      const legacyPath = pattern.replace('{pageId}', String(row.PageId)).replace('{fileName}', row.FileName);
      const caption = (row.Caption ?? '').trim();
      return {
        id: index + 1,
        pageId: row.PageId,
        sort: (index + 1) * 10,
        caption: /^(?:whatsapp image|img[_-]?\d|dsc|photo)\b/i.test(caption) ? '' : caption.slice(0, 300),
        src: legacyAsset(context, legacyPath, 'gallery', [legacyPath.replace('/Original/', '/Large/')]),
        width: null,
        height: null,
        createdAt: excelDateToIso(row.DateAdded, now)
      };
    });
}

function buildMenus(context: ImportContext, pages: Page[], seed: Seed): Menu[] {
  const pageByUrl = new Map(pages.map((page) => [context.urlById.get(page.id) ?? '', page]));
  const toItems = (items: Seed['menus']['main'], prefix: string): MenuItem[] =>
    items.map((item, index) => {
      const url = resolveSeedValue(context, item.url, 'content');
      const page = pageByUrl.get(url);
      return { id: `${prefix}-${slugify(url) || index}`, title: item.title, url, pageId: page?.id ?? null, sort: (index + 1) * 10, active: true, children: [] };
    });
  return [
    { id: 'main', name: 'Main navigation', description: 'Header navigation.', items: toItems(seed.menus.main, 'main') },
    { id: 'footer', name: 'Footer links', description: 'Links listed in the footer above the social media links.', items: toItems(seed.menus.footer, 'footer') }
  ];
}

function buildSettings(context: ImportContext, seed: Seed, now: string): Settings {
  const { favicon, faviconCrop, seo, ...rest } = seed.settings;
  const logoPath = new URL(context.config.logo.url).pathname;
  const logo = context.assets.add(context.config.logo.localPath, [normalizeLegacyPath(logoPath)], 'logo', context.config.logo.crop);
  return {
    ...defaultSettings(),
    ...rest,
    seo: { ...seo, defaultImage: resolveSeedValue(context, seo.defaultImage, 'social') },
    favicon: favicon.startsWith('legacy:')
      ? context.assets.add('/uploads/site/favicon.png', [normalizeLegacyPath(favicon.slice('legacy:'.length))], 'favicon', faviconCrop)
      : favicon,
    siteName: context.config.siteName,
    logo,
    updatedAt: now
  };
}

function sourceRow(rows: LegacyPageRow[], id: number): LegacyPageRow {
  const row = rows.find((entry) => entry.PageId === id);
  if (!row) {
    throw new Error(`Home source page ${id} not found in the workbook`);
  }
  return row;
}

function buildHome(context: ImportContext, rows: LegacyPageRow[], seed: Seed, now: string): Home {
  const seeded = seed.home;
  const aboutRow = sourceRow(rows, seeded.about.source);
  const aboutHtml = finalizeHtml(rewriteUrls(context, cleanLegacyHtml(aboutRow.PageContent ?? '')));
  const quotes = parseQuotes(sourceRow(rows, seeded.quotes.source).PageContent ?? '').slice(0, QUOTES_MAX);
  return {
    ...defaultHome(),
    hero: {
      ...seeded.hero,
      slides: seeded.hero.slides.map((slide) => ({
        image: slide.image ? resolveSeedValue(context, slide.image, 'hero') : '',
        video: slide.video ? resolveSeedValue(context, slide.video, null) : '',
        focus: slide.focus,
        caption: slide.caption
      })),
      cta: { label: seeded.hero.cta.label, url: resolveSeedValue(context, seeded.hero.cta.url, 'content') }
    },
    upcoming: seeded.upcoming,
    videos: seeded.videos,
    about: {
      enabled: seeded.about.enabled,
      title: seeded.about.title,
      heading: seeded.about.heading,
      content: aboutSummary(aboutHtml),
      image: resolveSeedValue(context, seeded.about.image, 'content'),
      cta: { label: seeded.about.cta.label, url: resolveSeedValue(context, seeded.about.cta.url, 'content') }
    },
    quotes: {
      enabled: seeded.quotes.enabled && quotes.length > 0,
      title: seeded.quotes.title,
      image: resolveSeedValue(context, seeded.quotes.image, 'hero'),
      items: quotes.map((quote) => ({ quote: quote.quote.slice(0, 1200), author: quote.author.slice(0, 120), role: quote.role.slice(0, 160) }))
    },
    events: seeded.events,
    news: seeded.news,
    updatedAt: now
  };
}

/** The home page shows the opening paragraphs of the biography; the full text stays on the biography page. */
function aboutSummary(html: string): string {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((match) => match[0]).filter((paragraph) => plainText(paragraph) !== '');
  const kept: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (kept.length > 0 && length > 600) {
      break;
    }
    kept.push(paragraph);
    length += plainText(paragraph).length;
  }
  return sanitizeRichText(kept.join('\n'));
}

function legacyVideo(row: LegacyPageRow, now: string, index: number): Video | null {
  const html = row.PageContent ?? '';
  const source = /data-oembed-url="([^"]+)"/i.exec(html)?.[1] ?? /<iframe[^>]+src="([^"]+)"/i.exec(html)?.[1] ?? '';
  const id = parseYoutubeId(source);
  if (!id) {
    return null;
  }
  const description = cleanTitle(row.SmallDescription ?? '');
  return {
    id,
    title: cleanTitle(row.Title).slice(0, 300),
    description: description.slice(0, 600),
    publishedAt: excelDateToIso(row.PublishDate ?? row.DateCreated, now),
    source: 'manual',
    pinned: false,
    hidden: false,
    sort: 100 + index,
    addedAt: now
  };
}

async function buildVideoLibrary(config: TransformConfig, videos: Video[], now: string): Promise<VideoLibrary> {
  const existing = existsSync(DATA_FILES.videos) ? videoLibrarySchema.parse(JSON.parse(await readFile(DATA_FILES.videos, 'utf8'))) : null;
  const library = existing ?? { ...defaultVideoLibrary(), updatedAt: now };
  if (!library.channelId) {
    try {
      library.channelId = await youtubeFeedSource.resolveChannelId(config.videos.channelHandleUrl);
      console.info(`  YouTube channel ${config.videos.channelHandleUrl} is ${library.channelId}`);
    } catch (error) {
      console.warn(`  could not resolve the YouTube channel (${error instanceof Error ? error.message : String(error)}); set it under Admin > Videos`);
    }
  }
  const known = new Set(library.items.map((item) => item.id));
  library.items = [...library.items, ...videos.filter((video) => !known.has(video.id))];
  return videoLibrarySchema.parse(library);
}

function buildSocial(seed: Seed, now: string): Social | null {
  if (existsSync(DATA_FILES.social)) {
    return null;
  }
  const posts = seed.social.instagram.posts.map((url) => {
    const parsed = parseInstagramUrl(url);
    if (!parsed) {
      throw new Error(`Seed Instagram post is not a post or reel link: ${url}`);
    }
    return { ...parsed, addedAt: now };
  });
  return socialSchema.parse({
    profiles: { ...emptySocialProfiles(), ...seed.social.profiles },
    instagram: { ...seed.social.instagram, enabled: seed.social.instagram.enabled && posts.length > 0, posts },
    facebook: seed.social.facebook,
    updatedAt: now
  });
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.info(`  wrote ${path.relative(PATHS.root, file)}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (existsSync(DATA_FILES.pages) && !force) {
    throw new Error('data/pages.json already exists. Re-run with "--force" to overwrite imported content (users, the video library and social settings are kept).');
  }

  const config = await loadTransformConfig();
  const seed = seedSchema.parse(JSON.parse(await readFile(resolveFromSite(config.contentSeed), 'utf8')));
  const workbookPath = resolveFromSite(config.contentWorkbook);
  console.info(`Reading ${workbookPath}`);
  const workbook = XLSX.read(readFileSync(workbookPath));
  const rows = readSheet(workbook, 'Pages', legacyPageRowSchema);
  const hidden = new Set(config.legacy.hiddenPageKeys.map((key) => key.toLowerCase()));
  const videoPageIds = new Set(seed.videoPages);

  const context: ImportContext = {
    config,
    legacyHost: new URL(config.legacySiteUrl).hostname.replace(/^www\./, ''),
    assets: new AssetCollector(),
    urlByLegacyKey: new Map(),
    urlById: new Map()
  };
  const now = new Date().toISOString();

  const rowIds = new Set(rows.map((row) => row.PageId));
  const pageRows = rows.filter(
    (row) => !hidden.has(legacyKey(row)) && !videoPageIds.has(row.PageId) && (row.ParentId === ROOT_PARENT || rowIds.has(row.ParentId))
  );
  const pages = pagesFileSchema.parse(buildPages(context, pageRows, seed, now));
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const urlOf = (page: Page): string => {
    const parent = page.parentId === null ? undefined : pageById.get(page.parentId);
    return `${parent ? urlOf(parent) : ''}/${page.slug}`;
  };
  const redirects = new Map<string, string>();
  const legacyKeyById = new Map(rows.map((row) => [row.PageId, legacyKey(row)]));
  for (const page of pages) {
    const url = urlOf(page);
    const key = legacyKeyById.get(page.id) ?? page.key;
    context.urlById.set(page.id, url);
    context.urlByLegacyKey.set(key, url);
    if (`/${key}` !== url.toLowerCase()) {
      redirects.set(`/${key}`, url);
    }
  }

  const videosRoot = pages.find((page) => page.kind === 'videos');
  const legacyVideos = rows
    .filter((row) => videoPageIds.has(row.PageId))
    .map((row, index) => {
      redirects.set(`/${legacyKey(row)}`, videosRoot ? urlOf(videosRoot) : '/');
      return legacyVideo(row, now, index);
    })
    .filter((video): video is Video => video !== null);
  for (const key of hidden) {
    redirects.set(`/${key}`, '/');
  }
  for (const redirect of seed.redirects) {
    redirects.set(redirect.from.toLowerCase(), redirect.to);
  }

  const sheetGallery = buildGallery(context, workbook, new Set(pages.map((page) => page.id)), now);
  const inline = moveContentImagesToGallery(context, pages, now, sheetGallery.length + 1);
  const contentPages = inline.pages.map((page) => ({ ...page, content: page.content ? finalizeHtml(rewriteUrls(context, page.content)) : '' }));
  const galleryImages = [...sheetGallery, ...inline.images];
  const menus = menusFileSchema.parse(buildMenus(context, contentPages, seed));
  const settings = settingsSchema.parse(buildSettings(context, seed, now));
  const home = homeSchema.parse(buildHome(context, rows, seed, now));
  const redirectList = redirectsFileSchema.parse([...redirects].map(([from, to]) => ({ from, to })));
  const library = await buildVideoLibrary(config, legacyVideos, now);
  const social = buildSocial(seed, now);

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, pagesFileSchema.parse(contentPages));
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse(galleryImages));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.redirects, redirectList);
  await writeJson(DATA_FILES.videos, library);
  if (social) {
    await writeJson(DATA_FILES.social, social);
  } else {
    console.info(`  kept ${path.relative(PATHS.root, DATA_FILES.social)} (editor settings are never overwritten by an import)`);
  }

  const manifest = context.assets.toManifest();
  if (existsSync(DATA_FILES.assetManifest)) {
    const previous = new Map((await readAssetManifest()).assets.filter((entry) => entry.status === 'ok').map((entry) => [entry.local, entry]));
    for (const entry of manifest.assets) {
      const known = previous.get(entry.local);
      if (known && known.preset === entry.preset && JSON.stringify(known.crop) === JSON.stringify(entry.crop)) {
        Object.assign(entry, { status: known.status, source: known.source, bytes: known.bytes, width: known.width, height: known.height });
      }
    }
  }
  await writeAssetManifest(manifest);
  console.info(`  wrote ${path.relative(PATHS.root, DATA_FILES.assetManifest)}`);

  console.info(
    `Imported ${contentPages.length} pages, ${galleryImages.length} gallery images, ${home.quotes.items.length} quotes, ${library.items.length} videos, ${redirectList.length} redirects, ${manifest.assets.length} assets.`
  );
  const drafts = contentPages.filter((page) => page.status === 'draft').map((page) => page.key);
  if (drafts.length > 0) {
    console.info(`Draft pages: ${drafts.join(', ')}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
