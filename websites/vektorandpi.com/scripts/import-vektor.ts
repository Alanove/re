/**
 * Import Vektor & PI content from content/bak-export.json
 * (produced by npm run export:bak) and the local app/ tree.
 *
 * Usage: npm run import:legacy [-- --force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import { defaultHome, defaultSettings } from '../src/domain/defaults.js';
import {
  albumsFileSchema,
  homeSchema,
  menusFileSchema,
  officesFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  redirectsFileSchema,
  settingsSchema,
  videosFileSchema,
  type MenuItem,
  type Page,
  type PageImage
} from '../src/domain/models.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import { AssetCollector, writeAssetManifest } from './lib/asset-manifest.js';

const KEY = /^[a-z0-9][a-z0-9_-]*$/;

const MAIN_MENU: { title: string; key: string; url: string }[] = [
  { title: 'Our Model', key: 'our-model', url: '/our-model' },
  { title: 'Our Services', key: 'our-services', url: '/our-services' },
  { title: 'Our Presence', key: 'our-presence', url: '/our-presence' },
  { title: 'About Us', key: 'about-us', url: '/about-us' },
  { title: 'Reach Us', key: 'reach-us', url: '/reach-us' }
];

interface BakExport {
  pages: Record<string, unknown>[];
  pageImages: Record<string, unknown>[];
}

function text(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return '';
}

function integer(value: unknown): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  const raw = text(value).toLowerCase();
  if (raw === 'true' || raw === 'yes') {
    return 1;
  }
  if (raw === 'false' || raw === 'no') {
    return 0;
  }
  const n = typeof value === 'number' ? value : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max).trim();
}

function limitedPlain(html: string, max: number): string {
  const plain = clip(toPlainText(html), max + 40);
  if (plain.length <= max) {
    return plain;
  }
  const room = Math.max(1, max - 3);
  const cut = plain.slice(0, room);
  const space = cut.lastIndexOf(' ');
  const base = (space > room * 0.6 ? cut.slice(0, space) : cut).trim();
  const result = `${base}...`;
  return result.length <= max ? result : result.slice(0, max);
}

function asKey(value: string, fallback: string): string {
  const key = value.trim().toLowerCase();
  if (KEY.test(key)) {
    return key;
  }
  const slugged = slugify(value);
  if (KEY.test(slugged)) {
    return slugged;
  }
  const safe = slugify(fallback) || fallback.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!KEY.test(safe)) {
    throw new Error(`Cannot use fallback key "${fallback}" for "${value}".`);
  }
  return safe;
}

function isoDate(value: unknown, fallback: string): string {
  const raw = text(value);
  if (!raw) {
    return fallback;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString();
}

function writeJson(file: string, value: unknown): Promise<void> {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function heroPaths(pageId: number, fileName: string): string[] {
  const base = `/PRV/Images/Pages/Page_${pageId}`;
  const ext = path.posix.extname(fileName);
  const stem = ext ? fileName.slice(0, -ext.length) : fileName;
  return [
    ...new Set([
      `${base}/${stem}-l${ext}`,
      `${base}/Large/${fileName}`,
      `${base}/${fileName}`,
      `${base}/${stem}-l.jpg`,
      `${base}/${stem}-L${ext}`
    ])
  ];
}

function galleryPaths(pageId: number, fileName: string): string[] {
  const base = `/PRV/Images/Pages/Page_${pageId}`;
  return [...new Set([`${base}/Large/${fileName}`, `${base}/Original/${fileName}`, `${base}/${fileName}`])];
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (!force && existsSync(DATA_FILES.pages)) {
    throw new Error('data/pages.json already exists. Run again with --force to replace the imported content.');
  }
  const config = await loadTransformConfig();
  const exportPath = resolveFromSite(config.contentWorkbook);
  if (!existsSync(exportPath)) {
    throw new Error(`Bak export not found at ${exportPath}. Run "npm run export:bak" first.`);
  }
  const bak = JSON.parse(await readFile(exportPath, 'utf8')) as BakExport;
  const contactKey = config.legacy.contactPageKey ?? 'reach-us';
  const now = new Date().toISOString();
  const assets = new AssetCollector();
  const claimed = new Map<string, string>();
  const hosts = new Set((config.legacy.legacyHosts ?? []).map((host) => host.replace(/^www\./, '').toLowerCase()));
  hosts.add(new URL(config.legacySiteUrl).hostname.replace(/^www\./, '').toLowerCase());

  const claim = (local: string, legacyPath: string, preset: ImagePreset | null): string => {
    const previous = claimed.get(local);
    if (previous && previous !== legacyPath) {
      const bumped = local.replace(/(\.[a-z0-9]+)$/i, `-${claimed.size}$1`);
      return claim(bumped, legacyPath, preset);
    }
    claimed.set(local, legacyPath);
    assets.add(local, [legacyPath], preset);
    return local;
  };

  const mapUrl = (raw: string): string | null => {
    let value = raw.trim().replace(/&amp;/g, '&');
    if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('/uploads/')) {
      return null;
    }
    if (value.startsWith('~')) {
      value = value.slice(1);
    }
    if (value.startsWith('//')) {
      value = `https:${value}`;
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (!hosts.has(url.hostname.replace(/^www\./, '').toLowerCase())) {
          return null;
        }
        value = `${url.pathname}${url.search}`;
      } catch {
        return null;
      }
    }
    if (!value.startsWith('/')) {
      return null;
    }
    let clean = value.split('?')[0]?.split('#')[0] ?? value;
    try {
      clean = decodeURIComponent(clean.replace(/\+/g, ' '));
    } catch {
      /* keep clean */
    }
    if (/\.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(clean)) {
      const name = slugify(path.posix.basename(clean).replace(/\.[a-z0-9]+$/i, '')) || 'document';
      const ext = path.posix.extname(clean).toLowerCase() || '.bin';
      return claim(`/uploads/legacy/documents/${name}${ext}`, clean, null);
    }
    if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(clean)) {
      const name = slugify(clean.replace(/^\/+/, '').replace(/\.[a-z0-9]+$/i, '')) || 'image';
      return claim(`/uploads/legacy/content/${name}.webp`, clean, 'content');
    }
    return null;
  };

  const rewriteHtml = (html: string): string =>
    html.replace(/(\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi, (match, attr: string, quote: string, raw: string) => {
      const mapped = mapUrl(raw);
      return mapped === null ? match : `${attr}${quote}${mapped}${quote}`;
    });

  const drafts: { id: number; parentId: number | null; key: string; childCount: number; ranking: number }[] = [];
  const pages: Page[] = [];
  const seenKeys = new Set<string>();
  const pageIds = new Set<number>();

  for (const [index, row] of bak.pages.entries()) {
    const id = integer(row.PageId);
    const parentRaw = integer(row.ParentId);
    if (id <= 0) {
      throw new Error(`Page row ${index + 1} has no id.`);
    }
    let key = asKey(text(row.URL), `page-${id}`);
    if (seenKeys.has(key)) {
      key = asKey(`${text(row.URL)}-${id}`, `page-${id}`);
    }
    if (pageIds.has(id) || seenKeys.has(key)) {
      throw new Error(`Duplicate page id ${id} or key ${key}.`);
    }
    pageIds.add(id);
    seenKeys.add(key);
    drafts.push({
      id,
      parentId: parentRaw > 0 ? parentRaw : null,
      key,
      childCount: 0,
      ranking: integer(row.Ranking)
    });
  }
  for (const page of drafts) {
    if (page.parentId !== null && !pageIds.has(page.parentId)) {
      page.parentId = null;
    }
    if (page.parentId !== null) {
      const parent = drafts.find((item) => item.id === page.parentId);
      if (parent) {
        parent.childCount += 1;
      }
    }
  }

  for (const [index, row] of bak.pages.entries()) {
    const meta = drafts[index];
    if (!meta) {
      continue;
    }
    const createdAt = isoDate(row.PublishDate, isoDate(row.DateCreated, now));
    const updatedAt = isoDate(row.DateModified, createdAt);
    const title = clip(text(row.Title) || meta.key, 200);
    const content = sanitizeRichText(rewriteHtml(text(row.PageContent)));
    const summarySource = text(row.SmallDescription);
    const imageName = text(row.Image);
    let heroImage = '';
    if (imageName) {
      const paths = heroPaths(meta.id, imageName);
      heroImage = claim(`/uploads/legacy/pages/${meta.key}.webp`, paths[0] ?? '', 'hero');
      assets.add(heroImage, paths, 'hero');
    }
    const kind: Page['kind'] =
      meta.key === contactKey
        ? 'contact'
        : meta.parentId === null && meta.childCount > 0 && content.trim() === ''
          ? 'section'
          : 'page';
    pages.push({
      id: meta.id,
      key: meta.key,
      parentId: meta.parentId,
      slug: meta.key,
      title,
      header: clip(text(row.Header) || title, 200),
      summary: clip(toPlainText(summarySource), 2000),
      content,
      status: integer(row.Status) === 1 ? 'published' : 'draft',
      kind,
      sort: meta.ranking > 0 ? 20_000 - meta.ranking : index + 1,
      icon: '',
      heroImage,
      heroVideo: '',
      seo: {
        title: clip(title, 200),
        description: limitedPlain(summarySource || content, 400),
        keywords: clip(text(row.Keywords), 500)
      },
      createdAt,
      updatedAt
    });
  }

  const pageImages: PageImage[] = [];
  const imageIds = new Set<number>();
  for (const row of bak.pageImages) {
    const id = integer(row.ImageId);
    const pageId = integer(row.PageId);
    const fileName = text(row.FileName);
    if (id <= 0 || pageId <= 0 || !fileName || !pageIds.has(pageId) || imageIds.has(id)) {
      continue;
    }
    imageIds.add(id);
    const page = pages.find((item) => item.id === pageId);
    const pageKey = page?.key ?? `page-${pageId}`;
    const legacyPaths = galleryPaths(pageId, fileName);
    const src = claim(`/uploads/legacy/page-images/${pageKey}/${id}.webp`, legacyPaths[0] ?? '', 'gallery');
    assets.add(src, legacyPaths, 'gallery');
    pageImages.push({
      id,
      pageId,
      sort: integer(row.Sort),
      caption: clip(text(row.Caption), 300),
      src,
      width: integer(row.Width) || null,
      height: integer(row.Height) || null,
      createdAt: isoDate(row.DateAdded, now)
    });
  }

  const home = homeSchema.parse({ ...defaultHome(), updatedAt: now });

  const menuItems: MenuItem[] = MAIN_MENU.map((item, index) => {
    const page = pages.find((candidate) => candidate.key === item.key);
    return {
      id: item.key,
      title: item.title,
      url: item.url,
      pageId: page?.id ?? null,
      sort: index + 1,
      active: true,
      htmlContent: '',
      children: []
    };
  });

  const menus = menusFileSchema.parse([
    {
      id: 'main',
      name: 'Main',
      description: 'Primary navigation',
      items: menuItems
    }
  ]);

  const offices = officesFileSchema.parse([
    {
      id: 'beirut',
      country: 'Lebanon',
      role: 'Headquarters',
      address: '',
      poBox: '',
      phones: [],
      fax: '',
      emails: ['reachus@vektorandpi.com'],
      mapQuery: '33.856589,35.535963',
      isPrimary: true,
      sort: 1
    }
  ]);

  const baseSettings = defaultSettings();
  const settings = settingsSchema.parse({
    ...baseSettings,
    logo: '/images/vektor-and-pi.png',
    favicon: '/favicon.ico',
    contactEmail: 'reachus@vektorandpi.com',
    tagline: 'ACHIEVE THROUGH PEOPLE',
    analyticsId: 'UA-172431180-1',
    googleMapsApiKey: 'AIzaSyCDXBhxQFY31T9cK_bYuDFETlVh7jOU_00',
    themeColor: '#231f20',
    social: {
      facebook: baseSettings.social.facebook,
      linkedin: baseSettings.social.linkedin,
      instagram: baseSettings.social.instagram,
      youtube: baseSettings.social.youtube,
      twitter: baseSettings.social.twitter
    },
    seo: {
      ...baseSettings.seo,
      defaultTitle: baseSettings.siteName,
      defaultDescription: baseSettings.description
    },
    updatedAt: now
  });

  const redirects = redirectsFileSchema.parse([
    { from: '/home', to: '/' },
    { from: '/default.aspx', to: '/' },
    { from: '/Default.aspx', to: '/' }
  ]);

  const validatedPages = pagesFileSchema.parse(pages);
  const validatedAlbums = albumsFileSchema.parse([]);
  const validatedVideos = videosFileSchema.parse([]);
  const manifest = assets.toManifest();

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, validatedPages);
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse(pageImages));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.redirects, redirects);
  await writeJson(DATA_FILES.albums, validatedAlbums);
  await writeJson(DATA_FILES.videos, validatedVideos);
  await writeAssetManifest(manifest);

  const published = validatedPages.filter((page) => page.status === 'published').length;
  const hiddenKeys = new Set(config.legacy.hiddenPageKeys);
  console.info(
    `Imported ${validatedPages.length} pages (${published} published), ${pageImages.length} page images, 0 albums, 0 videos, ${manifest.assets.length} assets. Main menu lists ${menuItems.length} items; hidden from menu: ${[...hiddenKeys].join(', ')}.`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}