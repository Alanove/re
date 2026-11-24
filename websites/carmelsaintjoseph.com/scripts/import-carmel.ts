/**
 * Import Collège du Carmel Saint Joseph content from content/bak-export.json
 * (produced by npm run export:bak) and the local wwwroot tree.
 *
 * Usage: npm run import:legacy [-- --force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import { defaultSettings } from '../src/domain/defaults.js';
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
  type Album,
  type AlbumImage,
  type AlbumSection,
  type MenuItem,
  type Page,
  type PageImage
} from '../src/domain/models.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import { AssetCollector, writeAssetManifest } from './lib/asset-manifest.js';

const KEY = /^[a-z0-9][a-z0-9_-]*$/;
const FUNDAHOPE = 'https://www.fundahope.com/fundraisers/assurons-lavenir-du-college-du-carmel-st-joseph';
const MENU_SKIP = new Set(['actualites', 'nos-albums', 'visite-virtuelle', 'la-colonie-d-ete', 'recrutement', 'contactez-nous', 'carmel-solidarite', 'dons-par-carte-de-credit']);
/** Live main nav treats these as leaf section links (children open from the page, not the menu). */
const MENU_FLAT = new Set(['projets-periscolaires-et-sociaux', 'communaute-religieuse']);

interface BakExport {
  pages: Record<string, unknown>[];
  pageImages: Record<string, unknown>[];
  albums: Record<string, unknown>[];
  albumImages: Record<string, unknown>[];
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
  return [...new Set([`${base}/${stem}-l${ext}`, `${base}/Large/${fileName}`, `${base}/${fileName}`, `${base}/${stem}-l.jpg`, `${base}/${stem}-L${ext}`])];
}

function albumSection(categoryId: number): AlbumSection {
  // Live site: CategoryId 2 albums appear under Visite Virtuelle; CategoryId 4 under Nos Albums.
  return categoryId === 2 ? 'visite-virtuelle' : 'nos-albums';
}

function pageUrl(pages: Page[], page: Page): string {
  const parts: string[] = [page.slug];
  let parentId = page.parentId;
  const seen = new Set<number>();
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = pages.find((item) => item.id === parentId);
    if (!parent) {
      break;
    }
    parts.unshift(parent.slug);
    parentId = parent.parentId;
  }
  return `/${parts.join('/')}`;
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
    const clean = value.split('?')[0]?.split('#')[0] ?? value;
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

  const newsRoot = drafts.find((page) => page.key === 'actualites');
  const heroByKey = new Map<string, string>();

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
      heroImage = claim(`/uploads/legacy/pages/${meta.key}.webp`, heroPaths(meta.id, imageName)[0] ?? '', 'hero');
      assets.add(heroImage, heroPaths(meta.id, imageName), 'hero');
      heroByKey.set(meta.key, heroImage);
    }
    const kind: Page['kind'] =
      meta.key === 'contactez-nous'
        ? 'contact'
        : meta.key === 'actualites'
          ? 'news'
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
      content: meta.key === 'contactez-nous' ? content : content,
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
    const src = claim(
      `/uploads/legacy/page-images/${pageKey}/${id}.webp`,
      `/PRV/Images/Pages/Page_${pageId}/Large/${fileName}`,
      'gallery'
    );
    assets.add(src, [
      `/PRV/Images/Pages/Page_${pageId}/Large/${fileName}`,
      `/PRV/Images/Pages/Page_${pageId}/${fileName}`,
      `/PRV/Images/Pages/Page_${pageId}/Thumb/${fileName}`
    ], 'gallery');
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

  const imagesByAlbum = new Map<number, AlbumImage[]>();
  const albumImageIds = new Set<number>();
  for (const row of bak.albumImages) {
    const id = integer(row.Id);
    const albumId = integer(row.AlbumId);
    const fileName = text(row.FileName);
    if (id <= 0 || albumId <= 0 || !fileName || albumImageIds.has(id)) {
      continue;
    }
    albumImageIds.add(id);
    const album = bak.albums.find((item) => integer(item.Id) === albumId);
    const albumKey = album ? asKey(text(album.Name), `album-${albumId}`) : `album-${albumId}`;
    const src = claim(`/uploads/legacy/albums/${albumKey}/${id}.webp`, `/PRV/Images/PhotoAlbums/Album${albumId}/Large/${fileName}`, 'gallery');
    assets.add(src, [
      `/PRV/Images/PhotoAlbums/Album${albumId}/Large/${fileName}`,
      `/PRV/Images/PhotoAlbums/Album${albumId}/Original/${fileName}`,
      `/PRV/Images/PhotoAlbums/Album${albumId}/${fileName}`
    ], 'gallery');
    const list = imagesByAlbum.get(albumId) ?? [];
    list.push({
      id,
      sort: integer(row.Sort),
      caption: clip(text(row.Caption), 300),
      src,
      width: null,
      height: null
    });
    imagesByAlbum.set(albumId, list);
  }

  const albums: Album[] = bak.albums.map((row, index) => {
    const id = integer(row.Id);
    const key = asKey(text(row.Name), `album-${id}`);
    const section = albumSection(integer(row.CategoryId));
    const createdAt = isoDate(row.AlbumDate, isoDate(row.DateAdded, now));
    const coverName = text(row.Image);
    const cover = coverName
      ? claim(`/uploads/legacy/albums/${key}-cover.webp`, `/PRV/Images/PhotoAlbums/Album${id}/${coverName}`, 'card')
      : '';
    if (coverName) {
      assets.add(cover, [
        `/PRV/Images/PhotoAlbums/Album${id}/${coverName}`,
        `/PRV/Images/PhotoAlbums/Album${id}/Large_${coverName}`,
        `/PRV/Images/PhotoAlbums/Album${id}/Thumb/${coverName}`
      ], 'card');
    }
    const images = (imagesByAlbum.get(id) ?? []).sort((a, b) => a.sort - b.sort || a.id - b.id);
    if (images.length > 400) {
      throw new Error(`Album ${key} has ${images.length} images, above the 400 image limit.`);
    }
    return {
      id,
      key,
      section,
      title: clip(text(row.DisplayName) || key, 200),
      summary: clip(toPlainText(text(row.Description)), 2000),
      cover,
      status: integer(row.Status) === 0 ? 'draft' : 'published',
      sort: index + 1,
      images,
      createdAt,
      updatedAt: isoDate(row.DateModified, createdAt)
    };
  });

  const slideConfigPath = path.join(PATHS.root, 'wwwroot', 'prv', 'conf', 'Slider.config');
  const slideConfig = existsSync(slideConfigPath) ? await readFile(slideConfigPath, 'utf8') : '';
  const slidePairs: { order: number; image: string }[] = [];
  for (const match of slideConfig.matchAll(/<Slides>[\s\S]*?<\/Slides>/gi)) {
    const block = match[0];
    const image = /<ImageUrl>([^<]*)<\/ImageUrl>/i.exec(block)?.[1]?.trim() ?? '';
    const order = Number(/<OrderNbr>(\d+)<\/OrderNbr>/i.exec(block)?.[1] ?? '0');
    if (image) {
      slidePairs.push({ order, image });
    }
  }
  slidePairs.sort((a, b) => a.order - b.order);
  const slides = slidePairs.map((slide) => {
    const file = /\.[a-z0-9]+$/i.test(slide.image) ? slide.image : `${slide.image}.jpg`;
    return {
      title: clip(slide.image.replace(/^-+/, '') || 'Slide', 160),
      label: '',
      url: '',
      image: claim(`/uploads/legacy/slides/${slugify(file.replace(/\.[a-z0-9]+$/i, '')) || 'slide'}.webp`, `/images/slides/${file}`, 'slide')
    };
  });

  // Header uses the legacy SVG wordmark (same as live). Emblem stays for OG/defaultImage.
  const logo = '/images/college-du-carmel-saint-joseph.svg';
  const emblem = claim('/uploads/site/logo.webp', '/images/college-du-carmel-saint-joseph-logo.png', 'logo');
  const favicon = claim('/uploads/site/favicon.png', '/images/apple-touch-icon-256x256.png', 'favicon');
  const aefe = claim('/uploads/legacy/site/aefe.webp', '/images/aefe.png', 'logo');
  const solidarityImage = claim('/uploads/legacy/site/carmel-solidarite.webp', '/images/carmel_solidarite.jpg', 'card');
  const virtualTourImage = claim('/uploads/legacy/site/visite-virtuelle.webp', '/images/visite-virtuelle.jpg', 'card');
  claim('/uploads/legacy/site/pronote-parents.webp', '/images/pronote-espace-parents.png', 'card');
  claim('/uploads/legacy/site/pronote-eleves.webp', '/images/pronote-espace-eleves.png', 'card');

  const marqueePath = path.join(PATHS.root, 'wwwroot', 'prv', 'StaticContent', 'marquee.htm');
  const marqueeHtml = existsSync(marqueePath) ? sanitizeRichText(await readFile(marqueePath, 'utf8')) : '';

  const director = pages.find((page) => page.key === 'mot-de-la-directrice');
  const mission = pages.find((page) => page.key === 'historique-et-mission');

  const home = homeSchema.parse({
    hero: { enabled: slides.length > 0, interval: 6, slides: slides.slice(0, 12) },
    about: {
      enabled: true,
      title: director?.header || 'Mot de la Directrice',
      content: limitedPlain(director?.summary || director?.content || '', 500),
      image: heroByKey.get('mot-de-la-directrice') ?? ''
    },
    mission: {
      enabled: true,
      title: mission?.header || 'Historique et Mission',
      content: limitedPlain(mission?.summary || mission?.content || '', 400),
      image: heroByKey.get('historique-et-mission') ?? '',
      url: '/le-ccsj/historique-et-mission'
    },
    tiles: [
      { title: 'Projet Educatif', url: '/le-ccsj/projet-educatif', imageClass: 'img-1' },
      { title: 'Projets Scolaires', url: '/enseignements-et-formation/fonctionnement-pedagogique/projets-scolaires', imageClass: 'img-2' },
      { title: 'Projets Périscolaires', url: '/la-vie-au-ccsj/projets-periscolaires-et-sociaux', imageClass: 'img-3' }
    ],
    marquee: marqueeHtml,
    solidarity: {
      enabled: true,
      image: solidarityImage,
      url: FUNDAHOPE,
      title: "Assurons l'avenir du Collège du Carmel St. Joseph!"
    },
    latestPosts: { enabled: true, title: 'Actualités', intro: '', limit: 3 },
    gallery: { enabled: true, title: 'Visite Virtuelle', intro: '' },
    updatedAt: now
  });

  const menuRoots = pages
    .filter((page) => page.parentId === null && page.status === 'published' && !MENU_SKIP.has(page.key))
    .sort((a, b) => a.sort - b.sort);

  const menuItem = (page: Page): MenuItem => ({
    id: `p${page.id}`,
    title: clip(page.title, 120),
    url: pageUrl(pages, page),
    pageId: page.id,
    sort: page.sort,
    active: true,
    htmlContent: '',
    children:
      page.key === 'actualites' || MENU_FLAT.has(page.key)
        ? []
        : pages
            .filter((child) => child.parentId === page.id && child.status === 'published')
            .sort((a, b) => a.sort - b.sort)
            .map((child) => menuItem(child))
  });

  const topLinks: MenuItem[] = [
    { id: 'top-actualites', title: 'Actualités', url: '/actualites', pageId: newsRoot?.id ?? null, sort: 1, active: true, htmlContent: '', children: [] },
    { id: 'top-visite', title: 'Visite Virtuelle', url: '/visite-virtuelle', pageId: pages.find((p) => p.key === 'visite-virtuelle')?.id ?? null, sort: 2, active: true, htmlContent: '', children: [] },
    { id: 'top-albums', title: 'Nos Albums', url: '/nos-albums', pageId: pages.find((p) => p.key === 'nos-albums')?.id ?? null, sort: 3, active: true, htmlContent: '', children: [] },
    { id: 'top-colonie', title: "La Colonie d'été", url: '/la-colonie-d-ete', pageId: pages.find((p) => p.key === 'la-colonie-d-ete')?.id ?? null, sort: 4, active: true, htmlContent: '', children: [] },
    { id: 'top-recrutement', title: 'Recrutement', url: '/recrutement', pageId: pages.find((p) => p.key === 'recrutement')?.id ?? null, sort: 5, active: true, htmlContent: '', children: [] },
    { id: 'top-contact', title: 'Contactez-nous', url: '/contactez-nous', pageId: pages.find((p) => p.key === 'contactez-nous')?.id ?? null, sort: 6, active: true, htmlContent: '', children: [] }
  ];

  const menus = menusFileSchema.parse([
    {
      id: 'main',
      name: 'Main',
      description: 'Primary navigation',
      items: [
        {
          id: 'accueil',
          title: 'Accueil',
          url: '/',
          pageId: null,
          sort: 0,
          active: true,
          htmlContent: '',
          children: []
        },
        ...menuRoots.map((page) => menuItem(page))
      ]
    },
    {
      id: 'top',
      name: 'Top',
      description: 'Header top links',
      items: topLinks
    }
  ]);

  const offices = officesFileSchema.parse([
    {
      id: 'mechref',
      country: 'Lebanon',
      role: 'Collège',
      address: 'Carmel Saint Joseph, Mechref - Damour',
      poBox: '',
      phones: ['+961 5 601 171', '+961 5 601 172', '+961 3 669 641'],
      fax: '+961 5 601 170',
      emails: ['info@carmelsaintjoseph.edu.lb'],
      mapQuery: 'Carmel Saint Joseph, Mechref Damour Lebanon',
      isPrimary: true,
      sort: 1
    }
  ]);

  const settings = settingsSchema.parse({
    ...defaultSettings(),
    logo,
    favicon,
    seo: {
      defaultTitle: 'Collège du Carmel Saint Joseph',
      defaultDescription: defaultSettings().description,
      defaultKeywords: 'CCSJ, Carmel Saint Joseph, Mechref, Damour, AEFE',
      defaultImage: emblem
    },
    updatedAt: now
  });

  const redirects = redirectsFileSchema.parse([
    { from: '/default.aspx', to: '/' },
    { from: '/index.aspx', to: '/' },
    { from: '/home', to: '/' },
    { from: '/contact-us', to: '/contactez-nous' },
    { from: '/je-fais-un-don', to: '/dons-par-carte-de-credit' }
  ]);

  // Keep aefe / virtual tour image paths referenced for the home template.
  void aefe;
  void virtualTourImage;

  const validatedPages = pagesFileSchema.parse(pages);
  const validatedAlbums = albumsFileSchema.parse(albums);
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
  await writeJson(DATA_FILES.videos, videosFileSchema.parse([]));
  await writeAssetManifest(manifest);

  const published = validatedPages.filter((page) => page.status === 'published').length;
  console.info(
    `Imported ${validatedPages.length} pages (${published} published), ${pageImages.length} page images, ${validatedAlbums.length} albums, ${manifest.assets.length} assets.`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
