import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite, type TransformConfig } from '../src/config/transform.js';
import { defaultHome, defaultSettings } from '../src/domain/defaults.js';
import {
  brandsFileSchema,
  categoriesFileSchema,
  homeSchema,
  menusFileSchema,
  officesFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  productsFileSchema,
  redirectsFileSchema,
  settingsSchema,
  type Brand,
  type Category,
  type HeroSlide,
  type Home,
  type Menu,
  type MenuItem,
  type Page,
  type Product,
  type Redirect,
  type Settings
} from '../src/domain/models.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { excerpt, sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import { AssetCollector, readAssetManifest, writeAssetManifest } from './lib/asset-manifest.js';
import { normalizeLegacyHtml } from './lib/normalize-legacy-html.js';
import { extractProductDetails, splitDashedListItems } from './lib/product-specs.js';

const SUMMARY_LENGTH = 240;
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip']);
const ROOT_PARENT = -1;

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
  PageType: nullableNumber,
  DateCreated: nullableNumber,
  DateModified: nullableNumber,
  Keywords: nullableString
});
type LegacyPageRow = z.infer<typeof legacyPageRowSchema>;

const seedLinkSchema = z.object({ label: z.string(), url: z.string() });
const seedMenuItemSchema = z.object({ title: z.string().min(1), url: z.string().min(1) });
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
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    social: z.object({ facebook: z.string(), instagram: z.string(), linkedin: z.string(), youtube: z.string() }),
    ctaBand: z.object({ title: z.string(), text: z.string(), label: z.string() }),
    thankYouMessage: z.string().min(1),
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
      summary: z.string().max(400).optional(),
      content: z.string().optional()
    })
  ),
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
  catalog: z.object({
    orphanCategory: z.string().min(1),
    draftCategories: z.array(z.string()),
    categoryOrder: z.array(z.string()),
    categoryOverrides: z.record(z.string(), z.object({ name: z.string().optional(), summary: z.string().optional(), icon: z.string().optional() })),
    brands: z.record(
      z.string(),
      z.object({ name: z.string().optional(), summary: z.string().optional(), website: z.string().optional(), featured: z.boolean().optional() })
    ),
    featuredProducts: z.array(z.string())
  }),
  home: z.object({
    hero: z.object({
      enabled: z.boolean(),
      useLegacySlider: z.boolean(),
      primaryCta: seedLinkSchema,
      secondaryCta: seedLinkSchema,
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
    categories: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), categorySlugs: z.array(z.string()) }),
    brands: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string() }),
    featuredProducts: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string(), limit: z.number().int().min(1).max(12), cta: seedLinkSchema }),
    whyUs: z.object({
      enabled: z.boolean(),
      title: z.string(),
      intro: z.string(),
      image: z.string(),
      items: z.array(z.object({ title: z.string().min(1), text: z.string(), icon: z.string() }))
    }),
    contact: z.object({ enabled: z.boolean(), title: z.string(), intro: z.string() })
  })
});
type Seed = z.infer<typeof seedSchema>;
type CatalogConfig = NonNullable<TransformConfig['catalog']>;

interface ImportContext {
  config: TransformConfig;
  legacyHost: string;
  assets: AssetCollector;
  urlByLegacyKey: Map<string, string>;
}

interface CatalogResult {
  categories: Category[];
  brands: Brand[];
  products: Product[];
  redirects: Redirect[];
  skipped: string[];
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
  const local = `${context.config.legacy.uploadsMirrorPrefix}${encodePathSegments(path.posix.join(parsed.dir, `${parsed.name}${extension}`))}`;
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
  return legacyAsset(context, pageImagePath(context, row.PageId, image), preset, [pageImagePath(context, row.PageId, `${parsed.name}-l${parsed.ext}`)]);
}

function resolveSeedValue(context: ImportContext, value: string, preset: ImagePreset): string {
  if (value.startsWith('legacy:')) {
    return legacyAsset(context, value.slice('legacy:'.length), preset);
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

function finalizeHtml(html: string): string {
  return sanitizeRichText(splitDashedListItems(normalizeLegacyHtml(sanitizeRichText(html))));
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

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let counter = 2;
  while (taken.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  taken.add(slug);
  return slug;
}

function addRedirect(redirects: Map<string, string>, from: string, to: string): void {
  if (from.toLowerCase().replace(/\/+$/, '') === to.toLowerCase() || redirects.has(from.toLowerCase())) {
    return;
  }
  redirects.set(from.toLowerCase(), to);
}

function buildCatalog(context: ImportContext, catalog: CatalogConfig, rows: LegacyPageRow[], seed: Seed, now: string): CatalogResult {
  const root = rows.find((row) => legacyKey(row) === catalog.productsRootKey.toLowerCase());
  if (!root) {
    throw new Error(`Products root page "${catalog.productsRootKey}" not found in the workbook`);
  }
  const rowIds = new Set(rows.map((row) => row.PageId));
  const categoryRows = rows.filter((row) => row.ParentId === root.PageId).sort((a, b) => a.PageId - b.PageId);
  const categoryIds = new Set(categoryRows.map((row) => row.PageId));
  const orphanCategoryRow = categoryRows.find((row) => slugify(row.URL) === seed.catalog.orphanCategory);
  if (!orphanCategoryRow) {
    throw new Error(`Seed orphanCategory "${seed.catalog.orphanCategory}" is not a category in the workbook`);
  }
  const productRows = rows
    .filter((row) => categoryIds.has(row.ParentId) || (row.ParentId > 0 && !rowIds.has(row.ParentId)))
    .sort((a, b) => a.PageId - b.PageId);
  const redirects = new Map<string, string>();
  const skipped: string[] = [];

  const brands: Brand[] = Object.entries(catalog.brandPageTypes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, legacyName], index) => {
      const baseSlug = slugify(legacyName);
      const override = seed.catalog.brands[baseSlug] ?? {};
      return {
        id: index + 1,
        slug: baseSlug,
        name: override.name ?? legacyName.trim(),
        logo: legacyAsset(context, catalog.brandLogoPattern.replace('{slug}', baseSlug), 'logo'),
        summary: override.summary ?? '',
        description: '',
        website: override.website ?? '',
        status: 'published',
        featured: override.featured ?? true,
        sort: (index + 1) * 10,
        seo: { title: '', description: override.summary ?? '', keywords: '' },
        createdAt: now,
        updatedAt: now
      };
    });
  const brandIdByType = new Map(
    Object.entries(catalog.brandPageTypes)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([typeId], index) => [Number(typeId), index + 1])
  );

  const productCountByCategory = new Map<number, number>();
  for (const row of productRows) {
    const categoryId = categoryIds.has(row.ParentId) ? row.ParentId : orphanCategoryRow.PageId;
    productCountByCategory.set(categoryId, (productCountByCategory.get(categoryId) ?? 0) + 1);
  }

  const categories: Category[] = categoryRows.map((row, index) => {
    const slug = slugify(row.URL);
    const override = seed.catalog.categoryOverrides[slug] ?? {};
    const orderIndex = seed.catalog.categoryOrder.indexOf(slug);
    const hasProducts = (productCountByCategory.get(row.PageId) ?? 0) > 0;
    const description = finalizeHtml(rewriteUrls(context, row.PageContent ?? ''));
    const summary = override.summary ?? excerpt(row.SmallDescription ?? description, SUMMARY_LENGTH);
    addRedirect(redirects, `/products/${row.URL.trim()}`, `/products/${slug}`);
    const createdAt = excelDateToIso(row.DateCreated, now);
    return {
      id: row.PageId,
      slug,
      name: override.name ?? cleanTitle(row.Title),
      summary,
      description,
      image: legacyPageImage(context, row, 'card'),
      icon: override.icon ?? '',
      status: row.Status > 0 && hasProducts && !seed.catalog.draftCategories.includes(slug) ? 'published' : 'draft',
      sort: (orderIndex === -1 ? categoryRows.length + index + 1 : orderIndex + 1) * 10,
      seo: { title: '', description: summary.slice(0, 400), keywords: (row.Keywords ?? '').trim().slice(0, 500) },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    };
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const legacyCategoryUrl = new Map(categoryRows.map((row) => [row.PageId, row.URL.trim()]));

  const takenSlugs = new Map<number, Set<string>>();
  const contentFingerprints = new Map<string, string>();
  const positionByCategory = new Map<number, number>();
  const products: Product[] = [];
  for (const row of productRows) {
    const isOrphan = !categoryIds.has(row.ParentId);
    const categoryId = isOrphan ? orphanCategoryRow.PageId : row.ParentId;
    const category = categoryById.get(categoryId);
    if (!category) {
      continue;
    }
    const name = cleanTitle(row.Title);
    const baseSlug = slugify(row.URL.replace(/_\d+$/, '')) || slugify(name);
    const fingerprint = `${categoryId}|${baseSlug}|${toPlainText(row.PageContent ?? '').replace(/\s+/g, ' ')}`;
    const duplicateOf = contentFingerprints.get(fingerprint);
    if (duplicateOf) {
      skipped.push(`${row.URL} (#${row.PageId}, duplicate of ${duplicateOf})`);
      continue;
    }
    const taken = takenSlugs.get(categoryId) ?? new Set<string>();
    takenSlugs.set(categoryId, taken);
    const slug = uniqueSlug(baseSlug, taken);
    contentFingerprints.set(fingerprint, `/products/${category.slug}/${slug}`);

    const details = extractProductDetails(rewriteUrls(context, row.PageContent ?? ''), name);
    const description = finalizeHtml(details.description);
    const summary = excerpt(description, SUMMARY_LENGTH) || details.tagline || excerpt(row.SmallDescription ?? '', SUMMARY_LENGTH);
    const position = (positionByCategory.get(categoryId) ?? 0) + 1;
    positionByCategory.set(categoryId, position);
    const image = legacyPageImage(context, row, 'product');
    const newUrl = `/products/${category.slug}/${slug}`;
    if (isOrphan) {
      addRedirect(redirects, `/${row.URL.trim()}`, newUrl);
    } else {
      const legacyCategory = legacyCategoryUrl.get(categoryId) ?? category.slug;
      addRedirect(redirects, `/products/${legacyCategory}/${row.URL.trim()}`, newUrl);
      addRedirect(redirects, `/${legacyCategory}/${row.URL.trim()}`, newUrl);
    }
    const createdAt = excelDateToIso(row.DateCreated, now);
    products.push({
      id: row.PageId,
      slug,
      categoryId,
      brandId: row.PageType === null ? null : (brandIdByType.get(row.PageType) ?? null),
      name,
      model: details.model,
      tagline: details.tagline.slice(0, 300),
      summary: summary.slice(0, 1000),
      specs: details.specs.slice(0, 40).map((spec) => ({ label: spec.label.slice(0, 120), value: spec.value.slice(0, 400) })),
      description,
      images: image ? [{ src: image, alt: name, width: null, height: null }] : [],
      featured: seed.catalog.featuredProducts.includes(slug),
      status: row.Status > 0 ? 'published' : 'draft',
      sort: position * 10,
      seo: { title: '', description: summary.slice(0, 400), keywords: (row.Keywords ?? '').trim().slice(0, 500) },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    });
  }

  for (const category of categories) {
    if (category.status === 'published' && !products.some((product) => product.categoryId === category.id && product.status === 'published')) {
      category.status = 'draft';
    }
  }

  return { categories, brands, products, redirects: [...redirects].map(([from, to]) => ({ from, to })), skipped };
}

function buildPages(context: ImportContext, rows: LegacyPageRow[], seed: Seed, now: string): Page[] {
  const ordered = [...rows].sort((a, b) => a.PageId - b.PageId);
  return ordered.map((row, index) => {
    const key = legacyKey(row);
    const override = seed.pageOverrides[key] ?? {};
    const isContact = key === context.config.legacy.contactPageKey;
    const content = isContact ? '' : finalizeHtml(rewriteUrls(context, override.content ?? row.PageContent ?? ''));
    const smallDescription = toPlainText(row.SmallDescription ?? '');
    const summary = override.summary ?? (smallDescription ? excerpt(smallDescription, SUMMARY_LENGTH) : excerpt(content, SUMMARY_LENGTH));
    const title = cleanTitle(override.title ?? row.Title);
    const header = cleanTitle(override.header ?? row.Header ?? '') || title;
    const createdAt = excelDateToIso(row.DateCreated, now);
    return {
      id: row.PageId,
      key,
      parentId: null,
      slug: key,
      title,
      header,
      summary,
      content,
      status: row.Status > 0 ? 'published' : 'draft',
      kind: isContact ? 'contact' : 'page',
      sort: (index + 1) * 10,
      icon: seed.pageIcons[key] ?? '',
      heroImage: legacyPageImage(context, row, 'hero'),
      heroVideo: '',
      seo: { title: '', description: summary.slice(0, 400), keywords: (row.Keywords ?? '').trim().slice(0, 500) },
      createdAt,
      updatedAt: excelDateToIso(row.DateModified, createdAt)
    };
  });
}

function buildMenus(context: ImportContext, pages: Page[], seed: Seed): Menu[] {
  const pageByUrl = new Map(pages.map((page) => [`/${page.slug}`, page]));
  const toItems = (items: Seed['menus']['main']): MenuItem[] =>
    items.map((item, index) => {
      const url = resolveSeedValue(context, item.url, 'content');
      const page = pageByUrl.get(url);
      return { id: `item-${slugify(item.title) || index}`, title: item.title, url, pageId: page?.id ?? null, sort: (index + 1) * 10, active: true, children: [] };
    });
  return [
    { id: 'main', name: 'Main navigation', description: 'Header navigation. Product categories are added to the Products menu automatically.', items: toItems(seed.menus.main) },
    { id: 'footer', name: 'Footer links', description: 'Quick links listed in the footer.', items: toItems(seed.menus.footer) }
  ];
}

function parseLegacySlides(context: ImportContext, catalog: CatalogConfig, seed: Seed): HeroSlide[] {
  if (!catalog.sliderConfig || !context.config.legacy.localRoot) {
    return [];
  }
  const file = path.join(resolveFromSite(context.config.legacy.localRoot), ...catalog.sliderConfig.split('/'));
  if (!existsSync(file)) {
    console.warn(`  slider config not found at ${file}`);
    return [];
  }
  const xml = readFileSync(file, 'utf8');
  const field = (block: string, name: string): string => {
    const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
    return (match?.[1] ?? '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  };
  return [...xml.matchAll(/<Slides>([\s\S]*?)<\/Slides>/g)]
    .map((match) => match[1] ?? '')
    .map((block) => ({ block, order: Number(field(block, 'OrderNbr')) || 0 }))
    .sort((a, b) => a.order - b.order)
    .map(({ block }) => {
      const imageName = field(block, 'ImageUrl');
      const url = field(block, 'URL');
      return {
        title: field(block, 'Title') || context.config.siteName,
        text: field(block, 'Description'),
        image: imageName ? legacyAsset(context, catalog.slideImagePattern.replace('{image}', imageName), 'slide') : '',
        video: '',
        zoom: 'out' as const,
        primaryCta: url ? { label: 'Learn more', url } : resolveSeedTree(context, seed.home.hero.primaryCta, 'content'),
        secondaryCta: resolveSeedTree(context, seed.home.hero.secondaryCta, 'content')
      };
    });
}

function buildSettings(context: ImportContext, seed: Seed, now: string): Settings {
  const resolved = resolveSeedTree(context, seed.settings, 'social');
  const logoPath = new URL(context.config.logo.url).pathname;
  const logo = context.assets.add(context.config.logo.localPath, [normalizeLegacyPath(logoPath)], 'logo');
  return {
    ...defaultSettings(),
    ...resolved,
    favicon: seed.settings.favicon.startsWith('legacy:') ? legacyAsset(context, seed.settings.favicon.slice('legacy:'.length), 'favicon') : seed.settings.favicon,
    siteName: context.config.siteName,
    logo,
    updatedAt: now
  };
}

function buildHome(context: ImportContext, catalog: CatalogConfig | null, seed: Seed, categories: Category[], now: string): Home {
  const seeded = seed.home;
  const legacySlides = seeded.hero.useLegacySlider && catalog ? parseLegacySlides(context, catalog, seed) : [];
  const seedSlides = resolveSeedTree(context, seeded.hero.slides, 'slide').map((slide) => ({ ...slide, zoom: slide.zoom ?? 'none' }));
  const categoryIds = seeded.categories.categorySlugs.flatMap((slug) => categories.filter((category) => category.slug === slug).map((category) => category.id));
  return {
    ...defaultHome(),
    hero: { enabled: seeded.hero.enabled, slides: [...seedSlides, ...legacySlides].slice(0, 6) },
    about: resolveSeedTree(context, seeded.about, 'content'),
    categories: { enabled: seeded.categories.enabled, title: seeded.categories.title, intro: seeded.categories.intro, categoryIds },
    brands: seeded.brands,
    featuredProducts: resolveSeedTree(context, seeded.featuredProducts, 'content'),
    whyUs: resolveSeedTree(context, seeded.whyUs, 'content'),
    contact: seeded.contact,
    updatedAt: now
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
  const rows = readSheet(workbook, 'Pages', legacyPageRowSchema);
  const catalog = config.catalog;
  const hidden = new Set(config.legacy.hiddenPageKeys.map((key) => key.toLowerCase()));

  const context: ImportContext = {
    config,
    legacyHost: new URL(config.legacySiteUrl).hostname.replace(/^www\./, ''),
    assets: new AssetCollector(),
    urlByLegacyKey: new Map()
  };
  const now = new Date().toISOString();

  const catalogRootKey = catalog?.productsRootKey.toLowerCase() ?? null;
  const pageRows = rows.filter((row) => row.ParentId === ROOT_PARENT && !hidden.has(legacyKey(row)) && legacyKey(row) !== catalogRootKey);
  for (const row of pageRows) {
    context.urlByLegacyKey.set(legacyKey(row), `/${legacyKey(row)}`);
  }
  if (catalogRootKey) {
    context.urlByLegacyKey.set(catalogRootKey, '/products');
  }

  const catalogResult: CatalogResult = catalog ? buildCatalog(context, catalog, rows, seed, now) : { categories: [], brands: [], products: [], redirects: [], skipped: [] };
  const pages = pagesFileSchema.parse(buildPages(context, pageRows, seed, now));
  const menus = menusFileSchema.parse(buildMenus(context, pages, seed));
  const offices = officesFileSchema.parse(seed.offices);
  const settings = settingsSchema.parse(buildSettings(context, seed, now));
  const home = homeSchema.parse(buildHome(context, catalog, seed, catalogResult.categories, now));
  const categories = categoriesFileSchema.parse(catalogResult.categories);
  const brands = brandsFileSchema.parse(catalogResult.brands);
  const products = productsFileSchema.parse(catalogResult.products);
  const redirects = redirectsFileSchema.parse(catalogResult.redirects);
  for (const asset of seed.extraAssets) {
    const extension = path.posix.extname(asset).toLowerCase();
    legacyAsset(context, asset, RASTER_EXTENSIONS.has(extension) ? 'content' : null);
  }

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, pages);
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse([]));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.categories, categories);
  await writeJson(DATA_FILES.brands, brands);
  await writeJson(DATA_FILES.products, products);
  await writeJson(DATA_FILES.redirects, redirects);
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

  const withSpecs = products.filter((product) => product.specs.length > 0).length;
  console.info(
    `Imported ${pages.length} pages, ${categories.length} categories, ${brands.length} brands, ${products.length} products (${withSpecs} with specifications), ${redirects.length} redirects, ${manifest.assets.length} assets.`
  );
  if (catalogResult.skipped.length > 0) {
    console.info(`Skipped duplicates: ${catalogResult.skipped.join('; ')}`);
  }
  const drafts = categories.filter((category) => category.status === 'draft').map((category) => category.slug);
  if (drafts.length > 0) {
    console.info(`Draft categories: ${drafts.join(', ')}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
