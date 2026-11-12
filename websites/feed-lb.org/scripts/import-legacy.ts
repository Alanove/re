import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite, type TransformConfig } from '../src/config/transform.js';
import { defaultHome, defaultSettings } from '../src/domain/defaults.js';
import {
  HERO_SLIDES_MAX,
  donationSettingsSchema,
  homeSchema,
  menusFileSchema,
  officesFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  partnersFileSchema,
  redirectsFileSchema,
  settingsSchema,
  type Home,
  type Menu,
  type MenuItem,
  type Page,
  type PageKind,
  type PageImage,
  type Partner,
  type Settings
} from '../src/domain/models.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { excerpt, sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import { AssetCollector, assetCropSchema, readAssetManifest, writeAssetManifest } from './lib/asset-manifest.js';
import { extractContentImages, plainText, readSlides } from './lib/legacy-content.js';
import { normalizeLegacyHtml } from './lib/normalize-legacy-html.js';

const SUMMARY_LENGTH = 240;
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
  Keywords: nullableString
});
type LegacyPageRow = z.infer<typeof legacyPageRowSchema>;

interface SeedMenuItem {
  title: string;
  url: string;
  children?: SeedMenuItem[] | undefined;
}
const seedMenuItemSchema: z.ZodType<SeedMenuItem> = z.lazy(() =>
  z.object({ title: z.string().min(1), url: z.string().min(1), children: z.array(seedMenuItemSchema).optional() })
);
const seedListSectionSchema = z.object({
  enabled: z.boolean(),
  title: z.string(),
  intro: z.string(),
  sourceKey: z.string().min(1),
  count: z.number().int().min(1)
});
const seedSchema = z.object({
  settings: z.object({
    tagline: z.string(),
    description: z.string(),
    contactEmail: z.email(),
    contactPhone: z.string(),
    whatsappNumber: z.string().default(''),
    brochureUrl: z.string(),
    favicon: z.string(),
    faviconCrop: assetCropSchema.nullable().default(null),
    footerText: z.string(),
    copyright: z.string(),
    inquiryTopics: z.array(z.string().min(1)).min(1),
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    social: z.object({ facebook: z.string(), instagram: z.string(), linkedin: z.string(), youtube: z.string() }),
    ctaBand: z.object({ title: z.string(), text: z.string(), label: z.string() }),
    thankYouMessage: z.string().min(1),
    donation: donationSettingsSchema,
    seo: z.object({
      defaultTitle: z.string(),
      defaultDescription: z.string(),
      defaultKeywords: z.string(),
      defaultImage: z.string()
    })
  }),
  extraAssets: z.array(z.string().startsWith('/')),
  pageIcons: z.record(z.string(), z.string()),
  pageOverrides: z.record(
    z.string(),
    z.object({
      title: z.string().min(1).optional(),
      header: z.string().optional(),
      slug: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).optional(),
      summary: z.string().max(400).optional(),
      content: z.string().optional(),
      heroImage: z.string().optional(),
      status: z.enum(['published', 'draft']).optional(),
      sort: z.number().int().optional()
    })
  ),
  galleryFromContent: z.array(z.string().min(1)),
  redirects: z.array(z.object({ from: z.string().startsWith('/'), to: z.string().regex(/^(?:\/|page:)/) })),
  menus: z.object({ main: z.array(seedMenuItemSchema).min(1), footer: z.array(seedMenuItemSchema) }),
  offices: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      country: z.string().min(1),
      role: z.string(),
      address: z.string(),
      poBox: z.string(),
      phones: z.array(z.string().min(1)),
      fax: z.string(),
      emails: z.array(z.email()),
      mapQuery: z.string(),
      isPrimary: z.boolean(),
      sort: z.number().int()
    })
  ),
  home: z.object({
    hero: z.object({ enabled: z.boolean(), interval: z.number().int().min(3).max(30), label: z.string() }),
    programs: seedListSectionSchema,
    about: seedListSectionSchema,
    news: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), count: z.number().int().min(1) }),
    team: seedListSectionSchema,
    partners: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string() }),
    donate: z.object({ enabled: z.boolean(), title: z.string(), text: z.string(), label: z.string(), image: z.string() })
  })
});
type Seed = z.infer<typeof seedSchema>;

interface ImportContext {
  config: TransformConfig;
  legacyHost: string;
  assets: AssetCollector;
  urlByLegacyKey: Map<string, string>;
}

function excelDateToIso(serial: number | null, fallback: string): string {
  if (serial === null || !Number.isFinite(serial)) {
    return fallback;
  }
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString();
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

function legacyAsset(context: ImportContext, legacyPath: string, preset: ImagePreset | null, fallbacks: string[] = []): string {
  const normalized = normalizeLegacyPath(legacyPath);
  const parsed = path.posix.parse(normalized);
  const extension = preset === null ? parsed.ext.toLowerCase() : preset === 'favicon' ? '.png' : '.webp';
  const local = `${context.config.legacy.uploadsMirrorPrefix}${encodePathSegments(path.posix.join(parsed.dir, `${parsed.name}${extension}`)).toLowerCase()}`;
  return context.assets.add(local, [normalized, ...fallbacks.map(normalizeLegacyPath)], preset);
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
  return legacyAsset(context, pageImagePath(context, row.PageId, image), preset, [pageImagePath(context, row.PageId, `${parsed.name}-m${parsed.ext}`)]);
}

function legacyBanner(context: ImportContext, key: string): string {
  const pattern = context.config.legacy.bannerPattern;
  return pattern ? legacyAsset(context, pattern.replace('{url}', key), 'hero') : '';
}

function resolveSeedValue(context: ImportContext, value: string, preset: ImagePreset | null): string {
  if (value.startsWith('legacy:')) {
    const legacyPath = value.slice('legacy:'.length);
    const extension = path.posix.extname(legacyPath).toLowerCase();
    return legacyAsset(context, legacyPath, VIDEO_EXTENSIONS.has(extension) || DOCUMENT_EXTENSIONS.has(extension) ? null : preset);
  }
  if (value.startsWith('page:')) {
    const [key, hash] = value.slice('page:'.length).split('#');
    const url = context.urlByLegacyKey.get(key ?? '');
    if (!url) {
      throw new Error(`Seed references unknown page key "${key ?? ''}"`);
    }
    return hash ? `${url}#${hash}` : url;
  }
  return value;
}

function resolveSeedTree<T>(context: ImportContext, value: T, preset: ImagePreset): T {
  if (typeof value === 'string') {
    return resolveSeedValue(context, value, preset) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => resolveSeedTree(context, item, preset)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSeedTree(context, item, preset)])) as T;
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
  const email = /^\/([^/@\s]+@[^/@\s]+\.[a-z]{2,})$/i.exec(pathname);
  if (email) {
    return `mailto:${email[1] ?? ''}`;
  }
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
  const withoutEditorCopies = html.replace(/\sdata-cke-saved-(?:href|src)\s*=\s*(["']).*?\1/gi, '');
  const rewritten = withoutEditorCopies.replace(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi, (_whole, attribute: string, quote: string, value: string) => {
    return `${attribute}=${quote}${rewriteLegacyUrl(context, value)}${quote}`;
  });
  return sanitizeRichText(rewritten);
}

function finalizeHtml(html: string): string {
  return sanitizeRichText(normalizeLegacyHtml(sanitizeRichText(html)));
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

function specialKind(config: TransformConfig, key: string): PageKind | null {
  const legacy = config.legacy;
  if (key === legacy.contactPageKey) {
    return 'contact';
  }
  if (key === legacy.newsPageKey) {
    return 'news';
  }
  if (key === legacy.donationsPageKey) {
    return 'donations';
  }
  if (key === legacy.partnersPageKey) {
    return 'partners';
  }
  return null;
}

function buildPages(context: ImportContext, rows: LegacyPageRow[], seed: Seed, now: string): Page[] {
  const ordered = [...rows].sort((a, b) => a.PageId - b.PageId);
  const takenSlugs = new Map<number | null, Set<string>>();
  const parentIds = new Set(rows.map((row) => row.ParentId));
  return ordered.map((row, index) => {
    const key = legacyKey(row);
    const override = seed.pageOverrides[key] ?? {};
    const special = specialKind(context.config, key);
    const isContact = special === 'contact';
    const rawContent = override.content ?? row.PageContent ?? '';
    const rawEmpty = toPlainText(rawContent) === '' && !/<img\b/i.test(rawContent);
    const isSection = special === null && parentIds.has(row.PageId) && (row.Status === ROUTE_ONLY_STATUS || rawEmpty);
    const parentId = row.ParentId === ROOT_PARENT ? null : row.ParentId;
    const content = isContact || isSection ? '' : rawContent;
    const smallDescription = plainText(row.SmallDescription ?? '');
    const summary = override.summary ?? (smallDescription ? excerpt(smallDescription, SUMMARY_LENGTH) : excerpt(content, SUMMARY_LENGTH));
    const title = cleanTitle(override.title ?? row.Title);
    const header = cleanTitle(override.header ?? row.Header ?? '') || title;
    const createdAt = excelDateToIso(row.DateCreated, now);
    const taken = takenSlugs.get(parentId) ?? new Set<string>();
    takenSlugs.set(parentId, taken);
    const base = override.slug ?? (slugify(key.replace(/_\d+$/, '')) || slugify(title) || `page-${row.PageId}`);
    let slug = base;
    for (let counter = 2; taken.has(slug); counter += 1) {
      slug = `${base}-${counter}`;
    }
    taken.add(slug);
    const heroImage = override.heroImage ? resolveSeedValue(context, override.heroImage, 'hero') : legacyPageImage(context, row, 'hero') || legacyBanner(context, key);
    const status = override.status ?? (row.Status > 0 ? 'published' : 'draft');
    const isEmpty = toPlainText(content) === '' && !/<img\b/i.test(content);
    return {
      id: row.PageId,
      key,
      parentId,
      slug,
      title,
      header,
      summary,
      content,
      status: status === 'published' && special === null && !isSection && isEmpty ? 'draft' : status,
      kind: special ?? (isSection ? 'section' : 'page'),
      sort: override.sort ?? (index + 1) * 10,
      icon: seed.pageIcons[key] ?? '',
      heroImage,
      heroVideo: '',
      seo: { title: '', description: summary.slice(0, 400), keywords: (row.Keywords ?? '').trim().slice(0, 500) },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    };
  });
}

function moveContentImagesToGallery(context: ImportContext, pages: Page[], keys: Set<string>, now: string): { pages: Page[]; images: PageImage[] } {
  const images: PageImage[] = [];
  const updated = pages.map((page) => {
    if (!keys.has(page.key)) {
      return page;
    }
    const { html, sources } = extractContentImages(page.content);
    sources.forEach((source, index) => {
      images.push({
        id: images.length + 1,
        pageId: page.id,
        sort: (index + 1) * 10,
        caption: '',
        src: legacyAsset(context, source.replace(/^(?:https?:)?\/\/[^/]+/i, ''), 'gallery'),
        width: null,
        height: null,
        createdAt: now
      });
    });
    return { ...page, content: html };
  });
  return { pages: updated, images };
}

function buildMenus(context: ImportContext, pages: Page[], seed: Seed): Menu[] {
  const pageByUrl = new Map(pages.map((page) => [context.urlByLegacyKey.get(page.key) ?? '', page]));
  const toItems = (items: SeedMenuItem[], prefix: string): MenuItem[] =>
    items.map((item, index) => {
      const url = resolveSeedValue(context, item.url, 'content');
      const page = pageByUrl.get(url);
      const id = `${prefix}${slugify(item.title) || index}`;
      return { id, title: item.title, url, pageId: page?.id ?? null, sort: (index + 1) * 10, active: true, children: toItems(item.children ?? [], `${id}-`) };
    });
  return [
    { id: 'main', name: 'Main navigation', description: 'Header navigation. Sub-items open as a dropdown on desktop and expand in the mobile menu.', items: toItems(seed.menus.main, 'item-') },
    { id: 'footer', name: 'Footer links', description: 'Quick links listed in the footer.', items: toItems(seed.menus.footer, 'item-') }
  ];
}

function buildSettings(context: ImportContext, seed: Seed, now: string): Settings {
  const { favicon, faviconCrop, ...rest } = seed.settings;
  const resolved = resolveSeedTree(context, rest, 'social');
  const logoPath = new URL(context.config.logo.url).pathname;
  const logo = context.assets.add(context.config.logo.localPath, [normalizeLegacyPath(logoPath)], 'logo');
  return {
    ...defaultSettings(),
    ...resolved,
    favicon: favicon.startsWith('legacy:')
      ? context.assets.add('/uploads/site/favicon.png', [normalizeLegacyPath(favicon.slice('legacy:'.length))], 'favicon', faviconCrop)
      : favicon,
    siteName: context.config.siteName,
    logo,
    updatedAt: now
  };
}

async function buildHome(context: ImportContext, seed: Seed, now: string): Promise<Home> {
  const seeded = seed.home;
  const slider = context.config.legacy.slider;
  const localRoot = context.config.legacy.localRoot ? resolveFromSite(context.config.legacy.localRoot) : null;
  const sliderFile = slider && localRoot ? path.join(localRoot, ...slider.configFile.split('/')) : null;
  const legacySlides = sliderFile && existsSync(sliderFile) ? readSlides(await readFile(sliderFile, 'utf8')) : [];
  return {
    ...defaultHome(),
    hero: {
      enabled: seeded.hero.enabled && legacySlides.length > 0,
      interval: seeded.hero.interval,
      slides: legacySlides.slice(0, HERO_SLIDES_MAX).map((slide) => ({
        title: slide.title.slice(0, 120),
        text: slide.description.slice(0, 300),
        url: slide.link ? rewriteLegacyUrl(context, slide.link) : '',
        label: slide.link ? seeded.hero.label : '',
        image: slider ? legacyAsset(context, slider.imagePattern.replace('{image}', slide.image), 'slide') : ''
      }))
    },
    programs: seeded.programs,
    about: seeded.about,
    news: seeded.news,
    team: seeded.team,
    partners: seeded.partners,
    donate: { ...seeded.donate, image: resolveSeedValue(context, seeded.donate.image, 'hero') },
    updatedAt: now
  };
}

/** The legacy partner rows: each child of the partners page is an external link (URL column) with a logo. */
function buildPartners(context: ImportContext, rows: LegacyPageRow[], now: string): Partner[] {
  const partnersKey = context.config.legacy.partnersPageKey;
  const partnersRow = partnersKey ? rows.find((row) => legacyKey(row) === partnersKey) : undefined;
  if (!partnersRow) {
    return [];
  }
  return rows
    .filter((row) => row.ParentId === partnersRow.PageId)
    .sort((a, b) => a.PageId - b.PageId)
    .map((row, index) => {
      const url = row.URL.trim();
      const createdAt = excelDateToIso(row.DateCreated, now);
      return {
        id: index + 1,
        name: cleanTitle(row.Title).slice(0, 160),
        website: /^https?:\/\//i.test(url) ? url.slice(0, 500) : '',
        logo: legacyPageImage(context, row, 'logo'),
        logoWidth: null,
        logoHeight: null,
        active: row.Status > 0,
        sort: (index + 1) * 10,
        createdAt,
        updatedAt: excelDateToIso(row.DateModified, createdAt)
      };
    });
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.info(`  wrote ${path.relative(PATHS.root, file)}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (existsSync(DATA_FILES.pages) && !force) {
    throw new Error('data/pages.json already exists. Re-run with "--force" to overwrite imported content (users, submissions and partners are kept).');
  }

  const config = await loadTransformConfig();
  const seed = seedSchema.parse(JSON.parse(await readFile(resolveFromSite(config.contentSeed), 'utf8')));
  const workbookPath = resolveFromSite(config.contentWorkbook);
  console.info(`Reading ${workbookPath}`);
  const workbook = XLSX.read(readFileSync(workbookPath));
  const rows = readSheet(workbook, 'Pages', legacyPageRowSchema);
  const hidden = new Set(config.legacy.hiddenPageKeys.map((key) => key.toLowerCase()));

  const context: ImportContext = {
    config,
    legacyHost: new URL(config.legacySiteUrl).hostname.replace(/^www\./, ''),
    assets: new AssetCollector(),
    urlByLegacyKey: new Map()
  };
  const now = new Date().toISOString();

  const rowIds = new Set(rows.map((row) => row.PageId));
  const partnersRowId = rows.find((row) => legacyKey(row) === config.legacy.partnersPageKey)?.PageId ?? null;
  const pageRows = rows.filter(
    (row) => !hidden.has(legacyKey(row)) && row.ParentId !== partnersRowId && (row.ParentId === ROOT_PARENT || rowIds.has(row.ParentId))
  );
  const pages = pagesFileSchema.parse(buildPages(context, pageRows, seed, now));
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const urlOf = (page: Page): string => {
    const parent = page.parentId === null ? undefined : pageById.get(page.parentId);
    return `${parent ? urlOf(parent) : ''}/${page.slug}`;
  };
  const redirects = new Map<string, string>();
  for (const page of pages) {
    const url = urlOf(page);
    context.urlByLegacyKey.set(page.key, url);
    const unsuffixed = page.key.replace(/_\d+$/, '');
    if (unsuffixed !== page.key && !pages.some((other) => other.key === unsuffixed)) {
      context.urlByLegacyKey.set(unsuffixed, url);
    }
    const legacyUrl = page.parentId === null ? `/${page.key}` : `${urlOf(pageById.get(page.parentId) ?? page)}/${page.key}`;
    if (legacyUrl.toLowerCase() !== url.toLowerCase()) {
      redirects.set(legacyUrl.toLowerCase(), url);
    }
  }
  for (const redirect of seed.redirects) {
    redirects.set(redirect.from.toLowerCase(), resolveSeedValue(context, redirect.to, 'content'));
  }

  const gallery = moveContentImagesToGallery(context, pages, new Set(seed.galleryFromContent), now);
  const contentPages = gallery.pages.map((page) => ({ ...page, content: page.content ? finalizeHtml(rewriteUrls(context, page.content)) : '' }));
  const menus = menusFileSchema.parse(buildMenus(context, contentPages, seed));
  const offices = officesFileSchema.parse(seed.offices);
  const settings = settingsSchema.parse(buildSettings(context, seed, now));
  const home = homeSchema.parse(await buildHome(context, seed, now));
  const partners = partnersFileSchema.parse(buildPartners(context, rows, now));
  const redirectList = redirectsFileSchema.parse([...redirects].map(([from, to]) => ({ from, to })));
  for (const asset of seed.extraAssets) {
    const extension = path.posix.extname(asset).toLowerCase();
    legacyAsset(context, asset, RASTER_EXTENSIONS.has(extension) ? 'content' : null);
  }

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, pagesFileSchema.parse(contentPages));
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse(gallery.images));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.redirects, redirectList);
  if (existsSync(DATA_FILES.partners)) {
    console.info(`  kept ${path.relative(PATHS.root, DATA_FILES.partners)} (partners edited in the admin are never overwritten by an import)`);
  } else {
    await writeJson(DATA_FILES.partners, partners);
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
    `Imported ${contentPages.length} pages, ${gallery.images.length} gallery images, ${home.hero.slides.length} hero slides, ${partners.length} partners, ${redirectList.length} redirects, ${manifest.assets.length} assets.`
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
