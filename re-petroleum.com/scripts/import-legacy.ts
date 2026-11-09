import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite, type TransformConfig } from '../src/config/transform.js';
import { defaultHome, defaultSettings } from '../src/domain/defaults.js';
import {
  homeSchema,
  menusFileSchema,
  officesFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  settingsSchema,
  type Home,
  type Menu,
  type MenuItem,
  type Office,
  type Page,
  type PageImage,
  type Settings
} from '../src/domain/models.js';
import { excerpt, sanitizeRichText, toPlainText } from '../src/services/sanitizeService.js';
import { AssetCollector, writeAssetManifest } from './lib/asset-manifest.js';
import { normalizeLegacyHtml } from './lib/normalize-legacy-html.js';

const SUMMARY_LENGTH = 240;
const ASSET_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'
]);
const CAMERA_WORDS = new Set(['img', 'image', 'dsc', 'dscn', 'sam', 'pb', 'slide', 'photo', 'pic', 'picture', 'screenshot', 'resized', 'untitled', 'copy']);

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
  Status: z.number().int(),
  Image: nullableString,
  DateCreated: nullableNumber,
  DateModified: nullableNumber,
  Keywords: nullableString
});
type LegacyPageRow = z.infer<typeof legacyPageRowSchema>;

const legacyImageRowSchema = z.object({
  ImageId: z.number().int().positive(),
  PageId: z.number().int().positive(),
  Sort: z.number().int().catch(100),
  Caption: nullableString,
  FileName: z.string().min(1),
  DateAdded: nullableNumber,
  Width: nullableNumber,
  Height: nullableNumber
});
type LegacyImageRow = z.infer<typeof legacyImageRowSchema>;

const seedLinkSchema = z.object({ label: z.string(), url: z.string() });
const seedSchema = z.object({
  settings: z.object({
    tagline: z.string(),
    description: z.string(),
    contactEmail: z.email(),
    contactPhone: z.string(),
    whatsappNumber: z.string().default(''),
    brochureUrl: z.string(),
    favicon: z.string(),
    footerText: z.string(),
    copyright: z.string(),
    inquiryTopics: z.array(z.string().min(1)).min(1),
    seo: z.object({
      defaultTitle: z.string(),
      defaultDescription: z.string(),
      defaultKeywords: z.string(),
      defaultImage: z.string()
    })
  }),
  extraAssets: z.array(z.string().startsWith('/')),
  assetAliases: z.record(z.string().startsWith('/'), z.string().startsWith('/')),
  pageIcons: z.record(z.string(), z.string()),
  pageOverrides: z.record(
    z.string(),
    z.object({
      title: z.string().min(1).optional(),
      header: z.string().optional(),
      summary: z.string().max(400).optional(),
      heroVideo: z.string().regex(/^\/uploads\/.+\.(mp4|webm)$/i).optional()
    })
  ),
  menus: z.object({ mainDepth: z.number().int().min(1).max(3), includeHome: z.boolean() }),
  offices: z.record(
    z.string(),
    z.object({
      role: z.string().optional(),
      isPrimary: z.boolean().optional(),
      sort: z.number().int().optional(),
      address: z.string().optional(),
      poBox: z.string().optional(),
      phones: z.array(z.string()).optional(),
      fax: z.string().optional(),
      emails: z.array(z.email()).optional(),
      mapQuery: z.string().max(200).optional()
    })
  ),
  home: z.object({
    hero: z.object({
      enabled: z.boolean(),
      slides: z.array(
        z.object({
          title: z.string(),
          text: z.string(),
          image: z.string(),
          video: z.string(),
          zoom: z.enum(['none', 'in', 'out']).optional(),
          primaryCta: seedLinkSchema,
          secondaryCta: seedLinkSchema
        })
      )
    }),
    about: z.object({ enabled: z.boolean(), title: z.string(), lead: z.string(), text: z.string(), image: z.string(), statValue: z.string(), statLabel: z.string(), cta: seedLinkSchema }),
    values: z.object({
      enabled: z.boolean(),
      title: z.string(),
      intro: z.string(),
      items: z.array(z.object({ title: z.string(), text: z.string(), icon: z.string(), highlight: z.boolean() }))
    }),
    solar: z.object({
      enabled: z.boolean(),
      title: z.string(),
      text: z.string(),
      image: z.string(),
      cards: z.array(z.object({ title: z.string(), text: z.string() })),
      listTitle: z.string(),
      list: z.array(z.string()),
      cta: seedLinkSchema
    }),
    activities: z.object({
      enabled: z.boolean(),
      title: z.string(),
      intro: z.string(),
      items: z.array(z.object({ title: z.string(), text: z.string(), image: z.string(), url: z.string() }))
    }),
    presence: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), image: z.string() }),
    contact: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string() })
  })
});
type Seed = z.infer<typeof seedSchema>;

interface ImportContext {
  config: TransformConfig;
  legacyOrigin: string;
  assetAliases: Record<string, string>;
  assets: AssetCollector;
  pageUrlByKey: Map<string, string>;
}

function excelDateToIso(serial: number | null, fallback: string): string {
  if (serial === null || !Number.isFinite(serial)) {
    return fallback;
  }
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString();
}

function encodePathSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
    .join('/');
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function legacyAsset(context: ImportContext, legacyPath: string, extraCandidates: string[] = []): string {
  const normalized = path.posix.normalize(`/${legacyPath.replace(/^\/+/, '')}`);
  const encoded = encodePathSegments(normalized);
  const local = `${context.config.legacy.uploadsMirrorPrefix}${encoded}`;
  const alias = context.assetAliases[normalized];
  const fallbacks = alias ? [...extraCandidates, alias] : extraCandidates;
  const candidates = [`${context.legacyOrigin}${encoded}`, ...fallbacks.map((candidate) => `${context.legacyOrigin}${encodePathSegments(candidate)}`)];
  return context.assets.add(local, candidates);
}

function resolveSeedValue(context: ImportContext, value: string): string {
  if (value.startsWith('legacy:')) {
    return legacyAsset(context, value.slice('legacy:'.length));
  }
  if (value.startsWith('page:')) {
    const [key, hash] = value.slice('page:'.length).split('#');
    const url = context.pageUrlByKey.get(key ?? '');
    if (!url) {
      throw new Error(`Seed references unknown page key "${key ?? ''}"`);
    }
    return hash ? `${url}#${hash}` : url;
  }
  return value;
}

function resolveSeedTree<T>(context: ImportContext, value: T): T {
  if (typeof value === 'string') {
    return resolveSeedValue(context, value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => resolveSeedTree(context, item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSeedTree(context, item)])) as T;
  }
  return value;
}

function rewriteLegacyUrl(context: ImportContext, rawValue: string): string {
  const value = rawValue.trim().replace(/&amp;/g, '&');
  if (value === '' || value.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(value)) {
    return rawValue;
  }
  const legacyHost = new URL(context.legacyOrigin).hostname.replace(/^www\./, '');
  const hostPattern = new RegExp(`^(?:https?:)?//(?:www\\.)?${legacyHost.replace(/\./g, '\\.')}(?=/|$|\\?|#)`, 'i');
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
  if (ASSET_EXTENSIONS.has(extension)) {
    return legacyAsset(context, pathname);
  }
  const lastSegment = decodeURIComponentSafe(pathname.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  const pageUrl = context.pageUrlByKey.get(lastSegment);
  return `${pageUrl ?? pathname}${hash}`;
}

function rewriteContent(context: ImportContext, html: string): string {
  const rewritten = html.replace(/\b(src|href)\s*=\s*(["'])(.*?)\2/gi, (_whole, attribute: string, quote: string, value: string) => {
    return `${attribute}=${quote}${rewriteLegacyUrl(context, value)}${quote}`;
  });
  return sanitizeRichText(normalizeLegacyHtml(sanitizeRichText(rewritten)));
}

function humanizeCaption(caption: string | null, fileName: string): string {
  const source = (caption ?? '').trim() || path.parse(fileName).name.replace(/_\d+$/, '');
  const meaningfulWords = source
    .split(/[^a-z0-9]+/i)
    .filter((word) => /^[a-z]{3,}$/i.test(word) && !CAMERA_WORDS.has(word.toLowerCase()) && !/^wa\d*$/i.test(word));
  if (meaningfulWords.length === 0) {
    return '';
  }
  const words = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
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

function computePageUrls(rows: LegacyPageRow[]): Map<number, string> {
  const byId = new Map(rows.map((row) => [row.PageId, row]));
  const urls = new Map<number, string>();
  const resolve = (row: LegacyPageRow, trail: Set<number>): string => {
    const cached = urls.get(row.PageId);
    if (cached) {
      return cached;
    }
    if (trail.has(row.PageId)) {
      throw new Error(`Cyclic parent chain at page ${row.PageId}`);
    }
    trail.add(row.PageId);
    const parent = row.ParentId > 0 ? byId.get(row.ParentId) : undefined;
    const url = `${parent ? resolve(parent, trail) : ''}/${row.URL.trim().toLowerCase()}`;
    urls.set(row.PageId, url);
    return url;
  };
  for (const row of rows) {
    resolve(row, new Set());
  }
  return urls;
}

function buildPages(context: ImportContext, rows: LegacyPageRow[], imageRows: LegacyImageRow[], seed: Seed, now: string): Page[] {
  const childCount = new Map<number, number>();
  for (const row of rows) {
    if (row.ParentId > 0) {
      childCount.set(row.ParentId, (childCount.get(row.ParentId) ?? 0) + 1);
    }
  }
  const galleryCount = new Map<number, number>();
  for (const image of imageRows) {
    galleryCount.set(image.PageId, (galleryCount.get(image.PageId) ?? 0) + 1);
  }
  const sortWithinParent = new Map<number, number>();
  const ordered = [...rows].sort((a, b) => a.PageId - b.PageId);

  return ordered.map((row) => {
    const key = row.URL.trim().toLowerCase();
    const override = seed.pageOverrides[key] ?? {};
    const parentKey = row.ParentId > 0 ? row.ParentId : 0;
    const position = (sortWithinParent.get(parentKey) ?? 0) + 1;
    sortWithinParent.set(parentKey, position);

    const content = rewriteContent(context, row.PageContent ?? '');
    const hasContent = toPlainText(content) !== '' || /<(img|table|iframe)\b/i.test(content);
    const hasChildren = (childCount.get(row.PageId) ?? 0) > 0;
    const hasGallery = (galleryCount.get(row.PageId) ?? 0) > 0;

    let kind: Page['kind'] = 'page';
    if (key === context.config.legacy.footerPageKey) {
      kind = 'footer';
    } else if (key === context.config.legacy.contactPageKey) {
      kind = 'contact';
    } else if (!hasContent && hasChildren) {
      kind = 'section';
    }
    const isEmptyLeaf = kind === 'page' && !hasContent && !hasChildren && !hasGallery;
    const status: Page['status'] = row.Status === 1 && !isEmptyLeaf ? 'published' : 'draft';

    const smallDescription = toPlainText(row.SmallDescription ?? '');
    const summary = override.summary ?? (smallDescription ? excerpt(smallDescription, SUMMARY_LENGTH) : excerpt(content, SUMMARY_LENGTH));

    let heroImage = '';
    const image = row.Image?.trim();
    if (image) {
      const parsed = path.posix.parse(image);
      const folder = `/Prv/Images/Pages/Page_${row.PageId}`;
      heroImage = legacyAsset(context, `${folder}/${parsed.name}-l${parsed.ext}`, [`${folder}/${image}`]);
    }

    const title = (override.title ?? row.Title).replace(/\s+/g, ' ').trim();
    const header = (override.header ?? row.Header ?? '').replace(/\s+/g, ' ').trim() || title;
    const createdAt = excelDateToIso(row.DateCreated, now);

    return {
      id: row.PageId,
      key,
      parentId: row.ParentId > 0 ? row.ParentId : null,
      slug: key,
      title,
      header: header === row.Title.trim() ? title : header,
      summary,
      content: kind === 'contact' ? '' : content,
      status,
      kind,
      sort: position * 10,
      icon: seed.pageIcons[key] ?? '',
      heroImage,
      heroVideo: override.heroVideo ?? '',
      seo: {
        title: '',
        description: summary.slice(0, 400),
        keywords: (row.Keywords ?? '').trim().slice(0, 500)
      },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    };
  });
}

function buildPageImages(context: ImportContext, rows: LegacyImageRow[], now: string): PageImage[] {
  return [...rows]
    .sort((a, b) => a.PageId - b.PageId || a.Sort - b.Sort || a.ImageId - b.ImageId)
    .map((row) => ({
      id: row.ImageId,
      pageId: row.PageId,
      sort: row.Sort,
      caption: humanizeCaption(row.Caption, row.FileName),
      src: legacyAsset(context, context.config.legacy.pageImagePattern.replace('{pageId}', String(row.PageId)).replace('{fileName}', row.FileName)),
      width: row.Width !== null && row.Width > 0 ? Math.round(row.Width) : null,
      height: row.Height !== null && row.Height > 0 ? Math.round(row.Height) : null,
      createdAt: excelDateToIso(row.DateAdded, now)
    }));
}

function isMenuCandidate(page: Page): boolean {
  return page.status === 'published' && (page.kind === 'page' || page.kind === 'section' || page.kind === 'contact');
}

function buildMenus(pages: Page[], pageUrls: Map<number, string>, seed: Seed): Menu[] {
  const childrenOf = (parentId: number | null): Page[] =>
    pages.filter((page) => page.parentId === parentId && isMenuCandidate(page)).sort((a, b) => a.sort - b.sort || a.id - b.id);

  const toItem = (page: Page, depth: number): MenuItem => ({
    id: `page-${page.id}`,
    title: page.title,
    url: pageUrls.get(page.id) ?? `/${page.slug}`,
    pageId: page.id,
    sort: page.sort,
    active: true,
    children: depth < seed.menus.mainDepth ? childrenOf(page.id).map((child) => toItem(child, depth + 1)) : []
  });

  const mainItems: MenuItem[] = childrenOf(null).map((page) => toItem(page, 1));
  if (seed.menus.includeHome) {
    mainItems.unshift({ id: 'home', title: 'Home', url: '/', pageId: null, sort: 0, active: true, children: [] });
  }
  const footerItems: MenuItem[] = childrenOf(null).map((page) => ({ ...toItem(page, seed.menus.mainDepth), children: [] }));

  return [
    { id: 'main', name: 'Main navigation', description: 'Header navigation imported from the legacy page tree.', items: mainItems },
    { id: 'footer', name: 'Footer links', description: 'Top-level pages listed in the footer.', items: footerItems }
  ];
}

function parseFooterOffices(footerHtml: string): Office[] {
  const offices: Office[] = [];
  const blockPattern = /<h4[^>]*>([\s\S]*?)<\/h4>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  for (const block of footerHtml.matchAll(blockPattern)) {
    const country = toPlainText(block[1] ?? '');
    if (!country) {
      continue;
    }
    const items = [...(block[2] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => item[1] ?? '');
    const emails: string[] = [];
    const lines: string[] = [];
    for (const item of items) {
      const mail = /mailto:([^"'?\s]+)/i.exec(item);
      if (mail?.[1]) {
        emails.push(mail[1].trim().toLowerCase());
      } else {
        const text = toPlainText(item);
        if (text) {
          lines.push(text);
        }
      }
    }
    const [firstLine = '', ...phoneLines] = lines;
    offices.push({
      id: country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country,
      role: '',
      address: firstLine,
      poBox: firstLine,
      phones: phoneLines.slice(0, 8),
      fax: '',
      emails: emails.filter((email) => z.email().safeParse(email).success).slice(0, 4),
      mapQuery: '',
      isPrimary: false,
      sort: (offices.length + 1) * 10
    });
  }
  return offices;
}

function buildOffices(footerHtml: string, seed: Seed): Office[] {
  const parsed = parseFooterOffices(footerHtml);
  const merged = parsed.map((office) => ({ ...office, ...(seed.offices[office.id] ?? {}) }));
  for (const [id, override] of Object.entries(seed.offices)) {
    if (!merged.some((office) => office.id === id)) {
      throw new Error(`Seed office "${id}" was not found in the legacy footer content`);
    }
    if (override.isPrimary) {
      for (const office of merged) {
        office.isPrimary = office.id === id;
      }
    }
  }
  return merged.sort((a, b) => a.sort - b.sort);
}

function buildSettings(context: ImportContext, seed: Seed, now: string): Settings {
  const resolved = resolveSeedTree(context, seed.settings);
  const logo = context.assets.add(context.config.logo.localPath, [context.config.logo.url]);
  return {
    ...defaultSettings(),
    ...resolved,
    siteName: context.config.siteName,
    logo,
    updatedAt: now
  };
}

function buildHome(context: ImportContext, seed: Seed, now: string): Home {
  const seeded = { ...defaultHome(), ...resolveSeedTree(context, seed.home), updatedAt: now };
  return {
    ...seeded,
    hero: {
      enabled: seeded.hero.enabled,
      slides: seeded.hero.slides.map((slide) => ({
        ...slide,
        zoom: slide.zoom ?? 'none'
      }))
    }
  };
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.info(`  wrote ${path.relative(PATHS.root, file)}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (existsSync(DATA_FILES.pages) && !force) {
    throw new Error('data/pages.json already exists. Re-run with "--force" to overwrite imported content (users and submissions are kept).');
  }

  const config = await loadTransformConfig();
  const seed = seedSchema.parse(JSON.parse(await readFile(resolveFromSite(config.contentSeed), 'utf8')));
  const workbookPath = resolveFromSite(config.contentWorkbook);
  console.info(`Reading ${workbookPath}`);
  const workbook = XLSX.read(readFileSync(workbookPath));

  const pageRows = readSheet(workbook, 'Pages', legacyPageRowSchema);
  const imageRows = readSheet(workbook, 'PageImages', legacyImageRowSchema);
  const knownPageIds = new Set(pageRows.map((row) => row.PageId));
  const orphanImages = imageRows.filter((row) => !knownPageIds.has(row.PageId));
  if (orphanImages.length > 0) {
    console.warn(`  skipping ${orphanImages.length} images attached to unknown pages`);
  }
  const validImageRows = imageRows.filter((row) => knownPageIds.has(row.PageId));

  const pageUrls = computePageUrls(pageRows);
  const context: ImportContext = {
    config,
    legacyOrigin: config.legacySiteUrl.replace(/\/+$/, ''),
    assetAliases: seed.assetAliases,
    assets: new AssetCollector(),
    pageUrlByKey: new Map(pageRows.map((row) => [row.URL.trim().toLowerCase(), pageUrls.get(row.PageId) ?? `/${row.URL}`]))
  };
  const now = new Date().toISOString();

  const pages = pagesFileSchema.parse(buildPages(context, pageRows, validImageRows, seed, now));
  const pageImages = pageImagesFileSchema.parse(buildPageImages(context, validImageRows, now));
  const menus = menusFileSchema.parse(buildMenus(pages, pageUrls, seed));
  const footerPage = pages.find((page) => page.key === config.legacy.footerPageKey);
  const footerRow = pageRows.find((row) => row.URL.trim().toLowerCase() === config.legacy.footerPageKey);
  if (!footerPage || !footerRow) {
    throw new Error(`Footer page "${config.legacy.footerPageKey}" not found in the workbook`);
  }
  const offices = officesFileSchema.parse(buildOffices(footerRow.PageContent ?? '', seed));
  const settings = settingsSchema.parse(buildSettings(context, seed, now));
  const home = homeSchema.parse(buildHome(context, seed, now));
  for (const asset of seed.extraAssets) {
    legacyAsset(context, asset);
  }

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, pages);
  await writeJson(DATA_FILES.pageImages, pageImages);
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.home, home);
  const manifest = context.assets.toManifest();
  await writeAssetManifest(manifest);
  console.info(`  wrote ${path.relative(PATHS.root, DATA_FILES.assetManifest)}`);

  const drafts = pages.filter((page) => page.status === 'draft' && page.kind === 'page');
  console.info(`Imported ${pages.length} pages, ${pageImages.length} gallery images, ${offices.length} offices, ${manifest.assets.length} assets to download.`);
  if (drafts.length > 0) {
    console.info(`Marked as draft (empty legacy content): ${drafts.map((page) => page.key).join(', ')}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
