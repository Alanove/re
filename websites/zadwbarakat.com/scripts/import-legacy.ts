/**
 * Builds the site data from the legacy crawl (content/crawl/pages.json), the Book Collector export (books.xml),
 * the hashtag sheets of the legacy workbook and the editorial seed (content/seed.json).
 * Users, inquiries and newsletter subscribers are never touched. Run `npm run download:assets` afterwards.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite, type TransformConfig } from '../src/config/transform.js';
import { defaultHome, defaultSettings } from '../src/domain/defaults.js';
import {
  albumsFileSchema,
  booksFileSchema,
  homeSchema,
  hymnsFileSchema,
  menusFileSchema,
  pageImagesFileSchema,
  pageKindSchema,
  pagesFileSchema,
  purchasesFileSchema,
  redirectsFileSchema,
  sectionsFileSchema,
  settingsSchema,
  sitePathSchema,
  videosFileSchema,
  type Album,
  type Article,
  type Book,
  type Home,
  type Hymn,
  type ImageRef,
  type Menu,
  type MenuItem,
  type Page,
  type Section,
  type Settings,
  type Video
} from '../src/domain/models.js';
import { normalizeForSearch } from '../src/lib/arabicNormalize.js';
import { encodePath } from '../src/lib/paths.js';
import { articlesRepository } from '../src/repositories/articlesRepository.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { excerpt, sanitizeRichText } from '../src/services/sanitizeService.js';
import { AssetCollector, INLINE_FOLDER, INLINE_PREFIX, readAssetManifest, writeAssetManifest } from './lib/asset-manifest.js';
import { crawledPagesFileSchema, normalizeLegacyPath, type CrawledPage, type CrawlListingItem } from './lib/crawl-model.js';
import { cleanLegacyHtml, decodeSafe, imageStem, legacyUploadPath, plainText, removeEmptyWrappers, safeSlug } from './lib/legacy-html.js';

const SUMMARY_LENGTH = 240;
const MINUTE = 60_000;
const SYNTHETIC_START = Date.parse('2014-01-01T00:00:00.000Z');
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
const FILE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pps', '.ppsx', '.zip', '.mp3', '.m4a', '.wma', '.mp4']);
const INLINE_TYPES: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
const JUNK_TAG = /^(?:[0-9a-f]{3}|[0-9a-f]{6}|_?ftn(?:ref)?\d*|\d+|nid-?\d+|sthash.*)$/i;

interface SeedMenuItem {
  title: string;
  url: string;
  children?: SeedMenuItem[] | undefined;
}
const seedMenuItemSchema: z.ZodType<SeedMenuItem> = z.lazy(() =>
  z.object({ title: z.string().min(1).max(120), url: z.string().min(1), children: z.array(seedMenuItemSchema).optional() })
);
const seedListSchema = z.object({ enabled: z.boolean(), title: z.string().max(120), count: z.number().int().min(1).max(12) });

const seedSchema = z.object({
  settings: z.object({
    tagline: z.string().max(200),
    description: z.string().max(400),
    logoSource: z.string().startsWith('/'),
    emblemSource: z.string().startsWith('/'),
    faviconSource: z.string().startsWith('/'),
    contactEmail: z.email(),
    contactPhone: z.string().max(40),
    address: z.string().max(300),
    mapQuery: z.string().max(200),
    footerText: z.string().max(400),
    copyright: z.string().max(200),
    inquiryTopics: z.array(z.string().min(1).max(80)).min(1).max(12),
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    social: z.object({ facebook: z.string(), x: z.string(), instagram: z.string(), youtube: z.string() }),
    relatedLinks: z.array(z.object({ label: z.string().min(1).max(80), url: z.string().max(500) })).max(8),
    thankYouMessage: z.string().min(1).max(400),
    newsletterThankYou: z.string().min(1).max(400),
    seo: z.object({ defaultTitle: z.string().max(200), defaultDescription: z.string().max(400), defaultKeywords: z.string().max(500) })
  }),
  sections: z
    .array(z.object({ path: sitePathSchema, listingPaths: z.array(z.string().startsWith('/')), title: z.string().min(1).max(160), intro: z.string().max(2000) }))
    .min(1),
  pages: z.array(
    z.object({
      key: z.string().min(1),
      slug: z.string().min(1),
      parent: z.string().nullable(),
      kind: pageKindSchema,
      title: z.string().min(1).max(200),
      summary: z.string().max(2000),
      icon: z.string().max(60),
      legacyPath: z.string().startsWith('/').nullable()
    })
  ),
  menus: z.object({ main: z.array(seedMenuItemSchema).min(1), footer: z.array(seedMenuItemSchema) }),
  home: z.object({
    spotlight: seedListSchema.extend({ section: z.string() }),
    sections: z.object({ enabled: z.boolean(), title: z.string().max(120), count: z.number().int().min(1).max(6), sections: z.array(z.string()) }),
    questions: seedListSchema.extend({ section: z.string(), intro: z.string().max(400) }),
    hymns: seedListSchema.extend({ intro: z.string().max(400) }),
    videos: seedListSchema,
    albums: seedListSchema,
    newsletter: z.object({ enabled: z.boolean(), title: z.string().max(160), text: z.string().max(400) })
  }),
  redirects: z.array(z.object({ from: z.string().startsWith('/'), to: z.string().min(1) }))
});
type Seed = z.infer<typeof seedSchema>;

const tagRowSchema = z.object({ TagId: z.number().int(), Tag: z.union([z.string(), z.number()]).transform(String) });
const tagRelationSchema = z.object({ TagId: z.number().int(), RelateTo: z.number().int(), RelationType: z.number().int().catch(1) });

interface ImportContext {
  config: TransformConfig;
  assets: AssetCollector;
  hosts: Set<string>;
  /** Legacy path (NFC, decoded) to its new site path, for links between imported pages. */
  pathMap: Map<string, string>;
  inline: Map<string, Buffer>;
}

interface ImportReport {
  skippedBrokenPages: { path: string; title: string }[];
  redirectedBrokenPages: { path: string; to: string }[];
  renamedPaths: { from: string; to: string }[];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function rootRelative(value: string): string {
  const cleaned = decodeSafe(value.trim().replace(/\\/g, '/'));
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

/** Registers a legacy file at an explicit upload path; the downloader fills it from the local copy or the live site. */
function assetAt(context: ImportContext, local: string, sources: string[], preset: ImagePreset | null): string {
  const legacyPaths = unique(sources.map(rootRelative).flatMap((source) => [source, source.normalize('NFC')]));
  return context.assets.add(local, legacyPaths, preset);
}

function legacyAsset(context: ImportContext, source: string, preset: ImagePreset | null, fallbacks: string[] = []): string {
  const raw = rootRelative(source);
  const extension = preset === null ? path.posix.extname(raw).toLowerCase() : preset === 'favicon' ? '.png' : '.webp';
  return assetAt(context, legacyUploadPath(context.config.legacy.uploadsMirrorPrefix, raw, extension), [raw, ...fallbacks], preset);
}

function inlineAsset(context: ImportContext, dataUri: string): string | null {
  const match = /^data:(image\/[a-z]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUri);
  const extension = match ? INLINE_TYPES[(match[1] ?? '').toLowerCase()] : undefined;
  if (!match || !extension) {
    return null;
  }
  const body = Buffer.from((match[2] ?? '').replace(/\s+/g, ''), 'base64');
  const name = `${createHash('sha1').update(body).digest('hex').slice(0, 16)}${extension}`;
  context.inline.set(name, body);
  return assetAt(context, `${context.config.legacy.uploadsMirrorPrefix}/inline/${name.replace(/\.\w+$/, '.webp')}`, [`${INLINE_PREFIX}${name}`], 'content');
}

/** Legacy page image sizes: the original, then `-l` and `-m`, so the best available copy is used. */
function pageImageCandidates(source: string): string[] {
  const raw = rootRelative(source);
  const match = /^(.*?)(?:-[lmts])?(\.[a-z0-9]+)$/i.exec(raw);
  if (!match) {
    return [raw];
  }
  const [, stem = '', extension = ''] = match;
  return unique([`${stem}${extension}`, `${stem}-l${extension}`, `${stem}-m${extension}`, raw]);
}

function imageRef(src: string): ImageRef {
  return { src, width: null, height: null };
}

function rewriteUrl(context: ImportContext, rawValue: string): string {
  const value = rawValue.trim().replace(/&amp;/g, '&');
  if (value === '' || value.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(value)) {
    return rawValue;
  }
  if (/^data:/i.test(value)) {
    return inlineAsset(context, value) ?? rawValue;
  }
  let remainder: string;
  const absolute = /^(?:https?:)?\/\/([^/?#]+)(.*)$/i.exec(value);
  if (absolute) {
    const host = (absolute[1] ?? '').toLowerCase().replace(/:\d+$/, '');
    if (!context.hosts.has(host)) {
      return rawValue;
    }
    remainder = absolute[2] || '/';
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return rawValue;
  } else {
    remainder = value.startsWith('/') ? value : `/${value}`;
  }
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(remainder);
  const pathname = decodeSafe(match?.[1] ?? '/').replace(/\\/g, '/');
  const hash = match?.[3] ?? '';
  const extension = path.posix.extname(pathname).toLowerCase();
  if (RASTER_EXTENSIONS.has(extension)) {
    return legacyAsset(context, pathname, 'content');
  }
  if (FILE_EXTENSIONS.has(extension)) {
    return legacyAsset(context, pathname, null);
  }
  const normalized = normalizeLegacyPath(pathname);
  if (normalized === '/' || /^\/(?:default|index)\.aspx$/i.test(normalized)) {
    return `/${hash}`;
  }
  return `${encodePath(context.pathMap.get(normalized) ?? normalized)}${hash}`;
}

function rewriteHtml(context: ImportContext, html: string): string {
  const cleaned = cleanLegacyHtml(html);
  const rewritten = cleaned
    .replace(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi, (_whole, attribute: string, quote: string, value: string) => `${attribute}=${quote}${rewriteUrl(context, value)}${quote}`)
    .replace(/<iframe\b(?![^>]*\bloading=)/gi, '<iframe loading="lazy"');
  return removeEmptyWrappers(sanitizeRichText(rewritten));
}

/** Drops the first body image that repeats the article's lead image, so it is not shown twice. */
function withoutLeadImage(html: string, leadImage: string): string {
  if (!leadImage) {
    return html;
  }
  const stem = imageStem(leadImage);
  let removed = false;
  return html.replace(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi, (tag, _quote: string, src: string) => {
    if (removed || imageStem(src) !== stem) {
      return tag;
    }
    removed = true;
    return '';
  });
}

function cleanTitle(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_whole, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_whole, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlValue(block: string, pattern: RegExp): string {
  return decodeXml(pattern.exec(block)?.[1] ?? '');
}

function xmlDisplayNames(block: string): string[] {
  return [...block.matchAll(/<displayname>([\s\S]*?)<\/displayname>/g)].map((match) => decodeXml(match[1] ?? '')).filter(Boolean);
}

async function readBooks(config: TransformConfig, now: string): Promise<Book[]> {
  const localRoot = config.legacy.localRoot ? resolveFromSite(config.legacy.localRoot) : null;
  const file = localRoot && config.legacy.booksFile ? path.join(localRoot, ...config.legacy.booksFile.split('/')) : null;
  if (!file || !existsSync(file)) {
    console.warn('  books.xml not found; the library starts empty.');
    return [];
  }
  const xml = await readFile(file, 'utf8');
  const books: Book[] = [];
  for (const match of xml.matchAll(/<book>([\s\S]*?)<\/book>/g)) {
    const block = match[1] ?? '';
    const title = cleanTitle(xmlValue(block, /<mainsection>[\s\S]*?<title>([\s\S]*?)<\/title>/), 300);
    if (!title) {
      continue;
    }
    const legacyId = Number.parseInt(xmlValue(block, /<id>(\d+)<\/id>/), 10);
    const pageCount = Number.parseInt(xmlValue(block, /<pagecount>(\d+)<\/pagecount>/), 10);
    const authors = xmlDisplayNames(/<authors>([\s\S]*?)<\/authors>/.exec(block)?.[1] ?? '');
    const subjects = xmlDisplayNames(/<subjects>([\s\S]*?)<\/subjects>/.exec(block)?.[1] ?? '');
    const subTitle = xmlValue(block, /<subtitle>([\s\S]*?)<\/subtitle>/);
    const plot = plainText(xmlValue(block, /<plot>([\s\S]*?)<\/plot>/));
    books.push({
      id: books.length + 1,
      legacyId: Number.isInteger(legacyId) && legacyId > 0 ? legacyId : null,
      title,
      author: unique(authors).join('، ').slice(0, 300),
      publisher: xmlValue(block, /<publisher>\s*<displayname>([\s\S]*?)<\/displayname>/).slice(0, 300),
      language: xmlValue(block, /<language>\s*<displayname>([\s\S]*?)<\/displayname>/).slice(0, 80),
      genre: xmlValue(block, /<genres>[\s\S]*?<displayname>([\s\S]*?)<\/displayname>/).slice(0, 120),
      subject: unique(subjects).join(' / ').slice(0, 300),
      format: xmlValue(block, /<format>\s*<displayname>([\s\S]*?)<\/displayname>/).slice(0, 80),
      year: xmlValue(block, /<publicationdate>\s*<year>\s*<displayname>([^<]*)<\/displayname>/).slice(0, 20),
      pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null,
      notes: [subTitle, plot].filter(Boolean).join(' — ').slice(0, 2000),
      active: true,
      createdAt: now,
      updatedAt: now
    });
  }
  return booksFileSchema.parse(books);
}

function readTags(config: TransformConfig): Map<number, string[]> {
  const tags = new Map<number, string[]>();
  const workbookPath = config.contentWorkbook ? resolveFromSite(config.contentWorkbook) : null;
  if (!workbookPath || !existsSync(workbookPath)) {
    return tags;
  }
  const workbook = XLSX.read(readFileSync(workbookPath));
  const rows = (name: string): Record<string, unknown>[] => {
    const sheet = workbook.Sheets[name];
    return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null }) : [];
  };
  const names = new Map<number, string>();
  for (const row of rows('HashTags')) {
    const parsed = tagRowSchema.safeParse(row);
    const tag = parsed.success ? parsed.data.Tag.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (parsed.success && tag.length >= 2 && tag.length <= 80 && !JUNK_TAG.test(tag.replace(/\s/g, ''))) {
      names.set(parsed.data.TagId, tag);
    }
  }
  for (const row of rows('HashTags_Relations')) {
    const parsed = tagRelationSchema.safeParse(row);
    const tag = parsed.success ? names.get(parsed.data.TagId) : undefined;
    if (parsed.success && tag) {
      const list = tags.get(parsed.data.RelateTo) ?? [];
      if (!list.includes(tag) && list.length < 30) {
        list.push(tag);
      }
      tags.set(parsed.data.RelateTo, list);
    }
  }
  return tags;
}

function segmentsOf(sitePath: string): string[] {
  return sitePath.split('/').filter(Boolean);
}

function buildSections(seed: Seed, now: string): Section[] {
  return sectionsFileSchema.parse(
    seed.sections.map((section, index) => ({
      id: index + 1,
      path: section.path,
      title: section.title,
      intro: section.intro,
      image: '',
      status: 'published',
      sort: (index + 1) * 10,
      seo: { title: '', description: '', keywords: '' },
      createdAt: now,
      updatedAt: now
    }))
  );
}

interface ArticleDraft {
  crawled: CrawledPage;
  section: Section;
  slug: string;
  listing: CrawlListingItem | null;
  legacyId: number | null;
}

function buildArticles(
  context: ImportContext,
  crawl: CrawledPage[],
  seed: Seed,
  sections: Section[],
  tags: Map<number, string[]>,
  redirects: Map<string, string>,
  report: ImportReport
): Article[] {
  const sectionBySegment = new Map(sections.map((section) => [segmentsOf(section.path)[0] ?? '', section]));
  const listingByPath = new Map<string, CrawlListingItem>();
  const listingOrder = new Map<number, string[]>();
  for (const [index, seeded] of seed.sections.entries()) {
    const section = sections[index];
    if (!section) {
      continue;
    }
    const listingPaths = new Set([seeded.path, ...seeded.listingPaths].map(normalizeLegacyPath));
    const order: string[] = [];
    const listings = crawl.filter((page) => page.status === 200 && listingPaths.has(page.path)).sort((a, b) => a.pageNumber - b.pageNumber);
    for (const page of listings) {
      for (const item of page.listing) {
        if (item.path && !listingByPath.has(item.path)) {
          listingByPath.set(item.path, item);
          order.push(item.path);
        }
      }
    }
    listingOrder.set(section.id, order);
  }

  const isArticlePath = (page: CrawledPage): boolean => {
    const segments = segmentsOf(page.path);
    return page.pageNumber === 1 && segments.length === 2 && sectionBySegment.has(segments[0] ?? '');
  };
  const drafts: ArticleDraft[] = [];
  const takenSlugs = new Map<number, Set<string>>();
  for (const crawled of crawl.filter((page) => page.status === 200 && isArticlePath(page))) {
    const [first = '', last = ''] = segmentsOf(crawled.path);
    const section = sectionBySegment.get(first);
    if (!section) {
      continue;
    }
    const listing = listingByPath.get(crawled.path) ?? null;
    const bodyId = /Page_(\d+)/i.exec(crawled.bodyHtml)?.[1];
    const legacyId = listing?.legacyId ?? (bodyId ? Number.parseInt(bodyId, 10) : null);
    const taken = takenSlugs.get(section.id) ?? new Set<string>();
    takenSlugs.set(section.id, taken);
    const base = safeSlug(last) || `article-${legacyId ?? drafts.length + 1}`;
    let slug = base;
    for (let counter = 2; taken.has(slug); counter += 1) {
      slug = `${base.slice(0, 114)}-${counter}`;
    }
    taken.add(slug);
    const sitePath = `${section.path}/${slug}`;
    context.pathMap.set(crawled.path, sitePath);
    if (sitePath !== crawled.path) {
      redirects.set(crawled.path, sitePath);
      report.renamedPaths.push({ from: crawled.path, to: sitePath });
    }
    drafts.push({ crawled, section, slug, listing, legacyId });
  }

  const titleKey = (value: string): string => normalizeForSearch(value).replace(/\s+/g, ' ').trim();
  const byTitle = new Map<string, string>();
  for (const draft of drafts) {
    const key = titleKey(plainText(draft.crawled.title) || draft.listing?.title || '');
    if (key && !byTitle.has(key)) {
      byTitle.set(key, `${draft.section.path}/${draft.slug}`);
    }
  }
  for (const broken of crawl.filter((page) => page.status !== 200 && isArticlePath(page))) {
    const title = listingByPath.get(broken.path)?.title ?? '';
    const target = title ? byTitle.get(titleKey(title)) : undefined;
    if (target) {
      redirects.set(broken.path, target);
      context.pathMap.set(broken.path, target);
      report.redirectedBrokenPages.push({ path: broken.path, to: target });
    } else {
      report.skippedBrokenPages.push({ path: broken.path, title });
    }
  }

  const maxLegacyId = Math.max(1, ...drafts.map((draft) => draft.legacyId ?? 0));
  const now = Date.now();
  const idDate = (legacyId: number): number => SYNTHETIC_START + (legacyId / maxLegacyId) * (now - SYNTHETIC_START);
  const publishedAt = new Map<ArticleDraft, string>();
  for (const section of sections) {
    const own = drafts.filter((draft) => draft.section.id === section.id);
    const position = new Map((listingOrder.get(section.id) ?? []).map((itemPath, index) => [itemPath, index]));
    const ordered = [...own].sort((a, b) => {
      const pa = position.get(a.crawled.path);
      const pb = position.get(b.crawled.path);
      if (pa !== undefined || pb !== undefined) {
        return (pa ?? Number.MAX_SAFE_INTEGER) - (pb ?? Number.MAX_SAFE_INTEGER);
      }
      return (b.legacyId ?? 0) - (a.legacyId ?? 0);
    });
    let previous = now;
    for (const draft of ordered) {
      const cap = draft.legacyId ? idDate(draft.legacyId) : previous;
      previous = Math.min(previous - MINUTE, cap);
      publishedAt.set(draft, new Date(previous).toISOString());
    }
  }

  return drafts
    .sort((a, b) => (publishedAt.get(b) ?? '').localeCompare(publishedAt.get(a) ?? ''))
    .map((draft, index): Article => {
      const leadSource = draft.listing?.image ?? '';
      const image = leadSource ? imageRef(legacyAsset(context, pageImageCandidates(leadSource)[0] ?? leadSource, 'content', pageImageCandidates(leadSource).slice(1))) : null;
      const content = rewriteHtml(context, withoutLeadImage(draft.crawled.bodyHtml, leadSource));
      const title = cleanTitle(plainText(draft.crawled.title) || draft.listing?.title || draft.slug.replace(/-/g, ' '), 250);
      const summary = (draft.listing?.summary ? cleanTitle(draft.listing.summary, 2000) : '') || excerpt(content, SUMMARY_LENGTH);
      const date = publishedAt.get(draft) ?? new Date(now).toISOString();
      return {
        id: index + 1,
        legacyId: draft.legacyId,
        sectionId: draft.section.id,
        slug: draft.slug,
        title,
        summary,
        content,
        image,
        direction: 'auto',
        tags: draft.legacyId ? (tags.get(draft.legacyId) ?? []) : [],
        status: 'published',
        publishedAt: date,
        dateKnown: false,
        seo: { title: '', description: '', keywords: '' },
        createdAt: date,
        updatedAt: date
      };
    });
}

function buildHymns(context: ImportContext, crawl: CrawledPage[], now: string): Hymn[] {
  const seen = new Set<string>();
  const rows = crawl
    .filter((page) => page.status === 200 && page.hymns.length > 0)
    .sort((a, b) => a.path.localeCompare(b.path) || a.pageNumber - b.pageNumber)
    .flatMap((page) => page.hymns);
  const hymns: Hymn[] = [];
  for (const row of rows) {
    const key = row.legacyId !== null ? `id:${row.legacyId}` : `file:${row.file}`;
    if (!row.file || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const source = rootRelative(row.file);
    const extension = path.posix.extname(source).toLowerCase();
    const name = row.legacyId ?? createHash('sha1').update(source).digest('hex').slice(0, 10);
    hymns.push({
      id: hymns.length + 1,
      legacyId: row.legacyId,
      title: cleanTitle(row.title, 250) || `ترتيلة ${hymns.length + 1}`,
      file: assetAt(context, `${context.config.legacy.uploadsMirrorPrefix}/hymns/${name}${extension}`, [source], null),
      singer: cleanTitle(row.singer, 250),
      author: cleanTitle(row.author, 250),
      album: cleanTitle(row.album, 250),
      category: cleanTitle(row.category, 160),
      sort: (hymns.length + 1) * 10,
      active: true,
      createdAt: now,
      updatedAt: now
    });
  }
  return hymnsFileSchema.parse(hymns);
}

function buildAlbums(context: ImportContext, crawl: CrawledPage[], now: string): Album[] {
  const pages = crawl.filter((page) => page.status === 200 && page.isAlbum && page.albumImages.length > 0);
  return albumsFileSchema.parse(
    pages.map((page, index): Album => {
      const albumId = /Album(\d+)/i.exec(page.albumImages[0] ?? '')?.[1];
      const slug = safeSlug(segmentsOf(page.path).pop() ?? '') || `album-${index + 1}`;
      const date = new Date(Date.parse(now) - index * MINUTE).toISOString();
      context.pathMap.set(page.path, `/photo-gallery/${slug}`);
      return {
        id: index + 1,
        legacyId: albumId ? Number.parseInt(albumId, 10) : null,
        slug,
        title: cleanTitle(plainText(page.title), 200) || slug.replace(/-/g, ' '),
        summary: '',
        images: unique(page.albumImages)
          .slice(0, 500)
          .map((source) => ({ ...imageRef(legacyAsset(context, source, 'gallery', [source.replace(/\/Large\//i, '/Thumb/')])), caption: '' })),
        status: 'published',
        sort: (index + 1) * 10,
        publishedAt: date,
        dateKnown: false,
        createdAt: date,
        updatedAt: date
      };
    })
  );
}

function buildVideos(context: ImportContext, crawl: CrawledPage[], now: string): Video[] {
  const thumbs = new Map<string, { title: string; image: string; order: number }>();
  for (const page of crawl) {
    page.videoThumbs.forEach((thumb, order) => {
      if (!thumbs.has(thumb.path)) {
        thumbs.set(thumb.path, { title: thumb.title, image: thumb.image, order });
      }
    });
  }
  const pages = crawl
    .filter((page) => page.status === 200 && page.youtubeId && segmentsOf(page.path)[0] === 'videos')
    .sort((a, b) => (thumbs.get(a.path)?.order ?? 999) - (thumbs.get(b.path)?.order ?? 999));
  return videosFileSchema.parse(
    pages.map((page, index): Video => {
      const thumb = thumbs.get(page.path);
      const slug = safeSlug(segmentsOf(page.path).pop() ?? '') || `video-${index + 1}`;
      const date = new Date(Date.parse(now) - index * MINUTE).toISOString();
      context.pathMap.set(page.path, `/videos/${slug}`);
      return {
        id: index + 1,
        slug,
        title: cleanTitle(plainText(page.title) || thumb?.title || slug, 200),
        summary: '',
        youtubeId: page.youtubeId,
        image: thumb?.image ? imageRef(legacyAsset(context, thumb.image, 'content')) : null,
        direction: 'auto',
        status: 'published',
        sort: (index + 1) * 10,
        publishedAt: date,
        dateKnown: false,
        createdAt: date,
        updatedAt: date
      };
    })
  );
}

function buildPages(seed: Seed, now: string): Page[] {
  const idByKey = new Map(seed.pages.map((page, index) => [page.key, index + 1]));
  return pagesFileSchema.parse(
    seed.pages.map((page, index): Page => {
      const parentId = page.parent === null ? null : (idByKey.get(page.parent) ?? null);
      if (page.parent !== null && parentId === null) {
        throw new Error(`Seed page "${page.key}" has an unknown parent "${page.parent}"`);
      }
      return {
        id: index + 1,
        key: page.key,
        parentId,
        slug: page.slug,
        title: page.title,
        header: '',
        summary: page.summary,
        content: '',
        status: 'published',
        kind: page.kind,
        direction: 'auto',
        sort: (index + 1) * 10,
        icon: page.icon,
        heroImage: '',
        heroVideo: '',
        seo: { title: '', description: page.summary.slice(0, 400), keywords: '' },
        createdAt: now,
        updatedAt: now
      };
    })
  );
}

function pageUrl(pages: Page[], page: Page): string {
  const parent = page.parentId === null ? undefined : pages.find((candidate) => candidate.id === page.parentId);
  return `${parent ? pageUrl(pages, parent) : ''}/${page.slug}`;
}

function resolveTarget(target: string, pages: Page[], sections: Section[]): { url: string; pageId: number | null } {
  if (target.startsWith('page:')) {
    const page = pages.find((candidate) => candidate.key === target.slice('page:'.length));
    if (!page) {
      throw new Error(`Seed references unknown page "${target}"`);
    }
    return { url: pageUrl(pages, page), pageId: page.id };
  }
  if (target.startsWith('section:')) {
    const section = sections.find((candidate) => candidate.path === target.slice('section:'.length));
    if (!section) {
      throw new Error(`Seed references unknown section "${target}"`);
    }
    return { url: section.path, pageId: null };
  }
  return { url: target, pageId: null };
}

function buildMenus(seed: Seed, pages: Page[], sections: Section[]): Menu[] {
  let counter = 0;
  const toItems = (items: SeedMenuItem[]): MenuItem[] =>
    items.map((item, index) => {
      counter += 1;
      const target = resolveTarget(item.url, pages, sections);
      return { id: `item-${counter}`, title: item.title, url: target.url, pageId: target.pageId, sort: (index + 1) * 10, active: true, children: toItems(item.children ?? []) };
    });
  return menusFileSchema.parse([
    { id: 'main', name: 'القائمة الرئيسية', description: 'Header navigation. Sub-items open as a dropdown on desktop and expand in the mobile menu.', items: toItems(seed.menus.main) },
    { id: 'footer', name: 'روابط التذييل', description: 'Quick links listed in the footer.', items: toItems(seed.menus.footer) }
  ]);
}

function buildHome(seed: Seed, sections: Section[], now: string): Home {
  const sectionId = (sectionPath: string): number | null => sections.find((section) => section.path === sectionPath)?.id ?? null;
  const { spotlight, sections: grid, questions, hymns, videos, albums, newsletter } = seed.home;
  return homeSchema.parse({
    ...defaultHome(),
    spotlight: { enabled: spotlight.enabled, title: spotlight.title, count: spotlight.count, sectionId: sectionId(spotlight.section) },
    sections: { enabled: grid.enabled, title: grid.title, count: grid.count, sectionIds: grid.sections.map(sectionId).filter((id): id is number => id !== null) },
    questions: { enabled: questions.enabled, title: questions.title, intro: questions.intro, count: questions.count, sectionId: sectionId(questions.section) },
    hymns,
    videos,
    albums,
    newsletter,
    updatedAt: now
  });
}

function buildSettings(context: ImportContext, seed: Seed, now: string): Settings {
  const { logoSource, emblemSource, faviconSource, seo, ...rest } = seed.settings;
  const logo = assetAt(context, context.config.logo.localPath, [logoSource], 'logo');
  return settingsSchema.parse({
    ...defaultSettings(),
    ...rest,
    siteName: context.config.siteName,
    logo,
    emblem: assetAt(context, '/uploads/site/emblem.webp', [emblemSource], 'logo'),
    favicon: assetAt(context, '/uploads/site/favicon.png', [faviconSource], 'favicon'),
    seo: { ...seo, defaultImage: logo },
    updatedAt: now
  });
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.info(`  wrote ${path.relative(PATHS.root, file)}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (existsSync(DATA_FILES.sections) && !force) {
    throw new Error('data/sections.json already exists. Re-run with "--force" to overwrite imported content (users, inquiries and subscribers are kept).');
  }
  const config = await loadTransformConfig();
  const crawlDir = resolveFromSite(config.crawl.outputDir);
  const crawlFile = path.join(crawlDir, 'pages.json');
  if (!existsSync(crawlFile)) {
    throw new Error(`Crawl output not found at ${crawlFile}. Run "npm run crawl:legacy" first.`);
  }
  console.info(`Reading ${path.relative(PATHS.root, crawlFile)}`);
  const crawl = crawledPagesFileSchema.parse(JSON.parse(await readFile(crawlFile, 'utf8')));
  const seed = seedSchema.parse(JSON.parse(await readFile(resolveFromSite(config.contentSeed), 'utf8')));
  const now = new Date().toISOString();
  const context: ImportContext = {
    config,
    assets: new AssetCollector(),
    hosts: new Set([new URL(config.legacySiteUrl).hostname, ...config.legacy.legacyHosts].map((host) => host.toLowerCase())),
    pathMap: new Map(),
    inline: new Map()
  };
  const report: ImportReport = { skippedBrokenPages: [], redirectedBrokenPages: [], renamedPaths: [] };
  const redirects = new Map<string, string>();

  const sections = buildSections(seed, now);
  const pages = buildPages(seed, now);
  for (const page of pages) {
    const seeded = seed.pages.find((entry) => entry.key === page.key);
    if (seeded?.legacyPath) {
      context.pathMap.set(normalizeLegacyPath(seeded.legacyPath), pageUrl(pages, page));
    }
  }
  for (const redirect of seed.redirects) {
    const target = resolveTarget(redirect.to, pages, sections).url;
    redirects.set(normalizeLegacyPath(redirect.from), target);
    context.pathMap.set(normalizeLegacyPath(redirect.from), target);
  }
  const albums = buildAlbums(context, crawl, now);
  const videos = buildVideos(context, crawl, now);
  const tags = readTags(config);
  const articles = buildArticles(context, crawl, seed, sections, tags, redirects, report);
  const hymns = buildHymns(context, crawl, now);
  const books = await readBooks(config, now);
  const contentPages = pagesFileSchema.parse(
    pages.map((page) => {
      const legacyPath = seed.pages.find((entry) => entry.key === page.key)?.legacyPath;
      const crawled = legacyPath ? crawl.find((entry) => entry.status === 200 && entry.pageNumber === 1 && entry.path === normalizeLegacyPath(legacyPath)) : undefined;
      return crawled ? { ...page, content: rewriteHtml(context, crawled.bodyHtml) } : page;
    })
  );
  const menus = buildMenus(seed, contentPages, sections);
  const home = buildHome(seed, sections, now);
  const settings = buildSettings(context, seed, now);
  const redirectList = redirectsFileSchema.parse(
    [...redirects].filter(([from, to]) => from !== to).map(([from, to]) => ({ from, to }))
  );

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.sections, sections);
  await articlesRepository.replaceAll(articles);
  console.info(`  wrote data/articles/ (${articles.length} files)`);
  await writeJson(DATA_FILES.books, books);
  await writeJson(DATA_FILES.hymns, hymns);
  await writeJson(DATA_FILES.albums, albums);
  await writeJson(DATA_FILES.videos, videos);
  if (!existsSync(DATA_FILES.purchases)) {
    await writeJson(DATA_FILES.purchases, purchasesFileSchema.parse([]));
  }
  await writeJson(DATA_FILES.pages, contentPages);
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse([]));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.redirects, redirectList);

  const inlineDir = path.join(crawlDir, INLINE_FOLDER);
  await mkdir(inlineDir, { recursive: true });
  for (const [name, body] of context.inline) {
    await writeFile(path.join(inlineDir, name), body);
  }
  const manifest = context.assets.toManifest();
  if (existsSync(DATA_FILES.assetManifest)) {
    const previous = new Map((await readAssetManifest()).assets.filter((entry) => entry.status === 'ok').map((entry) => [entry.local, entry]));
    for (const entry of manifest.assets) {
      const known = previous.get(entry.local);
      if (known && known.preset === entry.preset) {
        Object.assign(entry, { status: known.status, source: known.source, bytes: known.bytes, width: known.width, height: known.height });
      }
    }
  }
  await writeAssetManifest(manifest);
  console.info(`  wrote ${path.relative(PATHS.root, DATA_FILES.assetManifest)}`);
  await writeJson(path.join(crawlDir, 'import-report.json'), report);

  const tagged = articles.filter((article) => article.tags.length > 0).length;
  console.info(
    `Imported ${sections.length} sections, ${articles.length} articles (${tagged} tagged), ${books.length} books, ${hymns.length} hymns, ${albums.length} albums, ` +
      `${videos.length} videos, ${contentPages.length} pages, ${redirectList.length} redirects, ${manifest.assets.length} assets.`
  );
  console.info(
    `Broken legacy pages: ${report.redirectedBrokenPages.length} redirected to a copy with the same title, ${report.skippedBrokenPages.length} skipped (see content/crawl/import-report.json).`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
