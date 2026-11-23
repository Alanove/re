/**
 * One-off import from the legacy LiteWeb workbook and the templates that hold
 * the home slider, office and social links. Writes JSON with a plain file write.
 *
 * Usage: npm run import:legacy [-- --force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
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
  videosFileSchema
} from '../src/domain/models.js';
import type { Album, AlbumImage, MenuItem, Page, Video } from '../src/domain/models.js';
import { sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';
import type { ImagePreset } from '../src/services/imageProcessingService.js';
import { facebookPluginUrl, facebookWatchUrl, youtubeEmbedUrl, youtubeIdFromUrl, youtubeWatchUrl } from '../src/domain/watchLinks.js';
import { AssetCollector, writeAssetManifest } from './lib/asset-manifest.js';

const KEY = /^[a-z0-9][a-z0-9_-]*$/;
const GALLERY_INTRO =
  'Event Staging Professionals provided staging solutions to some of the biggest events in Lebanon. We have chosen to share with you some of the most incredible experiences we were lucky to be part of.';
const FACEBOOK = 'https://www.facebook.com/Event-Staging-Professionals-191299577578069/?fref=ts';

const SLIDES: { title: string; label: string; file: string }[] = [
  {
    title: 'MEA 70 Years',
    label:
      'For the special occasion marking MEA’s 70th anniversary, BDL and MEA together with more than 1500 distinguished guests, gathered in MEA’s hangar on a stage specially designed and built by Event Staging Professionals.',
    file: 'MEA-70-Years.jpg'
  },
  {
    title: 'Festivals',
    label: 'Event Staging Professionals built a reputation in being part of major festivals in Lebanon, including Baalbeck, Tyr and Sidon international festivals.',
    file: 'Festivals.jpg'
  },
  {
    title: 'Concerts',
    label: 'Event Staging Professionals is proud to have contributed in the success of concerts, musicals and performances in Beirut and other areas of Lebanon.',
    file: 'Concerts.jpg'
  },
  {
    title: 'Wedding',
    label: 'At Event Staging Professionals we have contributed in making the dream wedding come true for hundreds of couples all over Lebanon.',
    file: 'Wedding-Slider.jpg'
  }
];

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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return '';
}

function integer(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(text(value));
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

function isoFromExcel(value: unknown, fallback: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const n = typeof value === 'number' ? value : Number(text(value));
  if (!Number.isFinite(n) || n < 20_000 || n > 80_000) {
    return fallback;
  }
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86_400_000)).toISOString();
}

function asKey(value: string, label: string): string {
  const key = value.trim().toLowerCase();
  if (KEY.test(key)) {
    return key;
  }
  const slugged = slugify(value);
  if (!KEY.test(slugged)) {
    throw new Error(`Cannot use ${label} "${value}" as a key.`);
  }
  return slugged;
}

function sheetRows(book: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const sheet = book.Sheets[name];
  if (!sheet) {
    throw new Error(`Workbook is missing the ${name} sheet.`);
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
}

function writeJson(file: string, value: unknown): Promise<void> {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function heroPaths(pageId: number, fileName: string): string[] {
  const base = `/PRV/Images/Pages/Page_${pageId}`;
  const ext = path.posix.extname(fileName);
  const stem = ext ? fileName.slice(0, -ext.length) : fileName;
  return [...new Set([`${base}/${stem}-l${ext}`, `${base}/Large/${fileName}`, `${base}/${fileName}`])];
}

function videoLinks(objectHtml: string): Pick<Video, 'provider' | 'watchUrl' | 'embedUrl'> | null {
  const decoded = objectHtml.replace(/&amp;/g, '&');
  const youtube = /youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/i.exec(decoded);
  const youtubeId = youtube?.[1] && youtubeIdFromUrl(`https://www.youtube.com/embed/${youtube[1]}`);
  if (youtubeId) {
    return { provider: 'youtube', watchUrl: youtubeWatchUrl(youtubeId), embedUrl: youtubeEmbedUrl(youtubeId) };
  }
  const href = /data-href\s*=\s*["']([^"']+)["']/i.exec(decoded);
  const watch = href?.[1] ? facebookWatchUrl(href[1]) : null;
  if (watch) {
    return { provider: 'facebook', watchUrl: watch, embedUrl: facebookPluginUrl(watch) };
  }
  return null;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (!force && existsSync(DATA_FILES.pages)) {
    throw new Error('data/pages.json already exists. Run again with --force to replace the imported content.');
  }
  const config = await loadTransformConfig();
  const workbookPath = resolveFromSite(config.contentWorkbook);
  if (!existsSync(workbookPath)) {
    throw new Error(`Workbook not found at ${workbookPath}`);
  }
  const book = XLSX.read(await readFile(workbookPath), { type: 'buffer' });
  const now = new Date().toISOString();
  const assets = new AssetCollector();
  const claimed = new Map<string, string>();

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
    if (value.startsWith('//')) {
      value = `https:${value}`;
    }
    const youtubeId = /^https?:\/\//i.test(value) ? youtubeIdFromUrl(value) : null;
    if (youtubeId) {
      return youtubeEmbedUrl(youtubeId);
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.hostname.replace(/^www\./, '') !== 'eventstagingpro.com') {
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
    if (/\.php$/i.test(clean)) {
      return null;
    }
    if (/\.pdf$/i.test(clean)) {
      const name = slugify(path.posix.basename(clean).replace(/\.pdf$/i, '')) || 'document';
      return claim(`/uploads/legacy/documents/${name}.pdf`, clean, null);
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

  const pageRows = sheetRows(book, 'Pages');
  const drafts: { id: number; parentId: number | null; key: string; childCount: number }[] = [];
  const pages: Page[] = [];
  const seenKeys = new Set<string>();
  const pageIds = new Set<number>();

  pageRows.forEach((row, index) => {
    const id = integer(row.PageId);
    const parentRaw = integer(row.ParentId);
    const key = asKey(text(row.URL), 'page URL');
    if (id <= 0) {
      throw new Error(`Page row ${index + 1} has no id.`);
    }
    if (pageIds.has(id) || seenKeys.has(key)) {
      throw new Error(`Duplicate page id ${id} or key ${key}.`);
    }
    pageIds.add(id);
    seenKeys.add(key);
    drafts.push({ id, parentId: parentRaw > 0 ? parentRaw : null, key, childCount: 0 });
  });
  for (const page of drafts) {
    if (page.parentId !== null && !pageIds.has(page.parentId)) {
      throw new Error(`Page ${page.key} points at a missing parent ${page.parentId}.`);
    }
    if (page.parentId !== null) {
      const parent = drafts.find((item) => item.id === page.parentId);
      if (parent) {
        parent.childCount += 1;
      }
    }
  }

  const heroByKey = new Map<string, string>();
  pageRows.forEach((row, index) => {
    const meta = drafts[index];
    if (!meta) {
      return;
    }
    const createdAt = isoFromExcel(row.PublishDate, isoFromExcel(row.DateCreated, now));
    const updatedAt = isoFromExcel(row.DateModified, createdAt);
    const title = clip(text(row.Title) || meta.key, 200);
    const content = sanitizeRichText(rewriteHtml(text(row.PageContent)));
    const summarySource = text(row.SmallDescription);
    const imageName = text(row.Image);
    let heroImage = '';
    if (imageName) {
      heroImage = claim(`/uploads/legacy/pages/${meta.key}.webp`, heroPaths(meta.id, imageName)[0] ?? '', 'hero');
      const paths = heroPaths(meta.id, imageName);
      assets.add(heroImage, paths, 'hero');
      heroByKey.set(meta.key, heroImage);
    }
    const kind: Page['kind'] =
      meta.key === 'contact-us'
        ? 'contact'
        : meta.key === 'news-events'
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
      content,
      status: integer(row.Status) === 1 ? 'published' : 'draft',
      kind,
      sort: index + 1,
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
  });

  const albumRows = sheetRows(book, 'PhotoAlbums');
  const imageRows = sheetRows(book, 'PhotoAlbumImages');
  const imagesByAlbum = new Map<number, AlbumImage[]>();
  const imageIds = new Set<number>();
  for (const row of imageRows) {
    const id = integer(row.Id);
    const albumId = integer(row.AlbumId);
    const fileName = text(row.FileName);
    if (id <= 0 || albumId <= 0 || !fileName) {
      continue;
    }
    if (imageIds.has(id)) {
      throw new Error(`Duplicate album image id ${id}.`);
    }
    imageIds.add(id);
    const album = albumRows.find((item) => integer(item.Id) === albumId);
    const albumKey = album ? asKey(text(album.Name), 'album name') : `album-${albumId}`;
    const src = claim(`/uploads/legacy/albums/${albumKey}/${id}.webp`, `/PRV/Images/PhotoAlbums/Album${albumId}/Large/${fileName}`, 'gallery');
    assets.add(src, [`/PRV/Images/PhotoAlbums/Album${albumId}/Large/${fileName}`, `/PRV/Images/PhotoAlbums/Album${albumId}/Original/${fileName}`, `/PRV/Images/PhotoAlbums/Album${albumId}/${fileName}`], 'gallery');
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

  const albums: Album[] = albumRows.map((row, index) => {
    const id = integer(row.Id);
    const key = asKey(text(row.Name), 'album name');
    const createdAt = isoFromExcel(row.DateAdded, now);
    const coverName = text(row.Image);
    const cover = coverName
      ? claim(`/uploads/legacy/albums/${key}-cover.webp`, `/PRV/Images/PhotoAlbums/Album${id}/${coverName}`, 'card')
      : '';
    if (coverName) {
      assets.add(cover, [`/PRV/Images/PhotoAlbums/Album${id}/${coverName}`, `/PRV/Images/PhotoAlbums/Album${id}/Large_${coverName}`, `/PRV/Images/PhotoAlbums/Album${id}/Thumb/${coverName}`], 'card');
    }
    const images = (imagesByAlbum.get(id) ?? []).sort((a, b) => a.sort - b.sort || a.id - b.id);
    if (images.length > 400) {
      throw new Error(`Album ${key} has ${images.length} images, above the 400 image limit.`);
    }
    return {
      id,
      key,
      title: clip(text(row.DisplayName) || key, 200),
      summary: clip(toPlainText(text(row.Description)), 2000),
      cover,
      status: integer(row.Status) === 0 ? 'draft' : 'published',
      sort: index + 1,
      images,
      createdAt,
      updatedAt: isoFromExcel(row.DateModified, createdAt)
    };
  });

  const videos: Video[] = sheetRows(book, 'Videos').map((row, index) => {
    const id = integer(row.VideoId);
    const key = asKey(text(row.UniqueName), 'video name');
    const links = videoLinks(text(row.Object));
    if (!links) {
      throw new Error(`Video ${key} has no YouTube or Facebook link.`);
    }
    const thumbName = text(row.ThumbImage);
    const createdAt = isoFromExcel(row.DateCreated, now);
    return {
      id,
      key,
      title: clip(text(row.Title) || key, 200),
      summary: clip(toPlainText(text(row.Description)), 2000),
      thumb: thumbName ? claim(`/uploads/legacy/videos/${key}.webp`, `/PRV/Images/Videos/${thumbName}`, 'card') : '',
      provider: links.provider,
      watchUrl: links.watchUrl,
      embedUrl: links.embedUrl,
      status: integer(row.Status) > 0 ? 'published' : 'draft',
      sort: index + 1,
      createdAt,
      updatedAt: isoFromExcel(row.DateModified, createdAt)
    };
  });

  const slides = SLIDES.map((slide) => ({
    title: slide.title,
    label: slide.label,
    url: '',
    image: claim(`/uploads/legacy/slides/${slugify(slide.file.replace(/\.[a-z0-9]+$/i, ''))}.webp`, `/images/slides/${slide.file}`, 'slide')
  }));
  const logo = claim('/uploads/site/logo.webp', '/images/logo.png', 'logo');
  const favicon = claim('/uploads/site/favicon.png', '/images/logo.png', 'favicon');
  claim('/uploads/legacy/site/mea.webp', '/images/mea.jpg', 'hero');

  const about = pages.find((page) => page.key === 'about-us');
  const home = homeSchema.parse({
    hero: { enabled: slides.length > 0, interval: 6, slides },
    about: {
      enabled: true,
      title: 'About us',
      content: limitedPlain(about?.content ?? '', 400),
      image: heroByKey.get('about-us') ?? ''
    },
    latestPosts: { enabled: true, title: 'Latest Posts', intro: GALLERY_INTRO, limit: 3 },
    gallery: { enabled: true, title: 'Media Gallery', intro: GALLERY_INTRO },
    updatedAt: now
  });

  const menuItem = (page: Page): MenuItem => ({
    id: `p${page.id}`,
    title: clip(page.title, 120),
    url: page.parentId === null ? `/${page.slug}` : `/${pages.find((item) => item.id === page.parentId)?.slug ?? ''}/${page.slug}`,
    pageId: page.id,
    sort: page.sort,
    active: true,
    htmlContent: '',
    children: page.key === 'news-events' ? [] : pages.filter((child) => child.parentId === page.id && child.status === 'published').sort((a, b) => a.sort - b.sort).map((child) => menuItem(child))
  });
  const menus = menusFileSchema.parse([
    {
      id: 'main',
      name: 'Main',
      description: 'Primary navigation',
      items: [
        { id: 'home', title: 'Home', url: '/', pageId: null, sort: 0, active: true, htmlContent: '', children: [] },
        ...pages.filter((page) => page.parentId === null && page.status === 'published').sort((a, b) => a.sort - b.sort).map((page) => menuItem(page))
      ]
    }
  ]);

  const offices = officesFileSchema.parse([
    {
      id: 'bsous',
      country: 'Lebanon',
      role: 'Head office',
      address: 'BSOUS - LEBANON - MAIN ROAD - NEAR AL SAYDE CHURCH',
      poBox: '',
      phones: ['+961 5 940704', '+961 3 626479', '+961 70 185838'],
      fax: '',
      emails: ['info@eventstagingpro.com', 'e.stagingpro@gmail.com'],
      mapQuery: 'Bsous, Lebanon, Near Al Sayde Church',
      isPrimary: true,
      sort: 1
    }
  ]);

  const settings = settingsSchema.parse({
    ...defaultSettings(),
    logo,
    favicon,
    social: { ...defaultSettings().social, facebook: FACEBOOK },
    seo: {
      defaultTitle: 'Event Staging Professionals',
      defaultDescription: defaultSettings().description,
      defaultKeywords: '',
      defaultImage: logo
    },
    updatedAt: now
  });

  const redirects = redirectsFileSchema.parse([
    { from: '/default.aspx', to: '/' },
    { from: '/index.aspx', to: '/' },
    { from: '/home', to: '/' }
  ]);

  const validatedPages = pagesFileSchema.parse(pages);
  const validatedAlbums = albumsFileSchema.parse(albums);
  const validatedVideos = videosFileSchema.parse(videos);
  const manifest = assets.toManifest();

  await mkdir(PATHS.data, { recursive: true });
  await writeJson(DATA_FILES.pages, validatedPages);
  await writeJson(DATA_FILES.pageImages, pageImagesFileSchema.parse([]));
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.redirects, redirects);
  await writeJson(DATA_FILES.albums, validatedAlbums);
  await writeJson(DATA_FILES.videos, validatedVideos);
  await writeAssetManifest(manifest);

  const published = validatedPages.filter((page) => page.status === 'published').length;
  console.info(
    `Imported ${validatedPages.length} pages (${published} published), ${validatedAlbums.length} albums, ${validatedVideos.length} videos, ${manifest.assets.length} assets.`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
