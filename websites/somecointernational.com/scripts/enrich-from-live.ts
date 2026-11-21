/**
 * Pull thin/missing product (and about/services) copy + images from the live
 * Someco site into local JSON + /uploads/legacy/live/.
 *
 * Usage: npx tsx scripts/enrich-from-live.ts [--force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig } from '../src/config/transform.js';
import { thumbUrl } from '../src/domain/media.js';
import {
  menusFileSchema,
  pageImagesFileSchema,
  pagesFileSchema,
  type Menu,
  type MenuItem,
  type Page,
  type PageImage
} from '../src/domain/models.js';
import { imageProcessingService, type ImagePreset } from '../src/services/imageProcessingService.js';
import { excerpt, sanitizeRichText, slugify, toPlainText } from '../src/services/sanitizeService.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; someco-enrich/1.0)';
const REQUEST_TIMEOUT_MS = 45_000;
const THIN_CHARS = 80;
const FORCE = process.argv.includes('--force');

interface LiveTarget {
  key: string;
  livePath: string;
  /** Create the page when missing */
  create?: {
    title: string;
    parentKey: string;
    kind?: Page['kind'];
    sort?: number;
  };
}

/** Explicit crawl list from the polish plan (skip live 404/500 category paths). */
const TARGETS: LiveTarget[] = [
  { key: 'about', livePath: '/about-us' },
  { key: 'services', livePath: '/services' },
  { key: 'atlas-copco-construction', livePath: '/products/construction-equipment/atlas-copco-construction' },
  { key: 'case-construction-equipment', livePath: '/products/construction-equipment/case-construction-equipment' },
  { key: 'tdi-power-attachments', livePath: '/products/construction-equipment/tdi-power-attachments' },
  { key: 'atlas-copco-industrial', livePath: '/products/industrial-equipment/atlas-copco-industrial' },
  { key: 'haulotte-aerial-work-platform', livePath: '/products/industrial-equipment/haulotte-aerial-work-platform' },
  {
    key: 'truemax-professional-machinery',
    livePath: '/products/construction-equipment/truemax-professional-machinery',
    create: { title: 'Truemax Professional Machinery', parentKey: 'construction-equipment', sort: 9500 }
  },
  {
    key: 'fm-gru-construction-cranes',
    livePath: '/products/construction-equipment/fm-gru-construction-cranes',
    create: { title: 'FM GRU Construction Cranes', parentKey: 'construction-equipment', sort: 9600 }
  },
  {
    key: 'doosan-industrial-vehicle',
    livePath: '/products/industrial-equipment/doosan-industrial-vehicle',
    create: { title: 'Doosan Industrial Vehicle', parentKey: 'industrial-equipment', sort: 14000 }
  },
  {
    key: 'miller-itw-welding',
    livePath: '/products/industrial-equipment/miller-itw-welding',
    create: { title: 'Miller ITW Welding', parentKey: 'industrial-equipment', sort: 15000 }
  },
  {
    key: 'mimar-trading-for-building-materials',
    livePath: '/products/mimar-trading-for-building-materials',
    create: { title: 'MIMAR Trading for Building Materials', parentKey: 'products', sort: 11000 }
  }
];

interface ParsedLive {
  title: string;
  heroSrc: string | null;
  heroAlt: string;
  bodyHtml: string;
  imageSrcs: string[];
}

function absoluteLiveUrl(siteUrl: string, src: string): string {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  const base = siteUrl.replace(/\/$/, '');
  return src.startsWith('/') ? `${base}${src}` : `${base}/${src}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)));
}

function extractArticle(html: string): string | null {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article?.[1]) {
    return article[1];
  }
  const content = html.match(/<section\b[^>]*\bid=["']content["'][^>]*>([\s\S]*?)<\/section>/i);
  return content?.[1] ?? null;
}

function stripChrome(articleHtml: string): { title: string; heroSrc: string | null; heroAlt: string; body: string } {
  let html = articleHtml;
  let title = '';
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i);
  if (header) {
    const h1 = header[1].match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    title = toPlainText(h1?.[1] ?? '');
    html = html.replace(header[0], '');
  }
  let heroSrc: string | null = null;
  let heroAlt = '';
  const figure = html.match(/<figure\b[^>]*>\s*<img\b([^>]+)>[\s\S]*?<\/figure>/i);
  if (figure) {
    const src = figure[1].match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? null;
    const alt = figure[1].match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
    heroSrc = src;
    heroAlt = decodeHtmlEntities(alt);
    html = html.replace(figure[0], '');
  }
  // Drop leftover h1 + hr if present outside header
  html = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>\s*(?:<hr\s*\/?>)?/i, '');
  html = html.replace(/<div\s+class=["']separator-2["']\s*>\s*<\/div>/gi, '');
  // Strip contact widgets / share chrome sometimes injected in body
  html = html.replace(/<div\b[^>]*class=["'][^"']*(?:share|contact-widget|sidebar)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return { title, heroSrc, heroAlt, body: html.trim() };
}

/** Match img `src` only — not `data-cke-saved-src` or similar. */
const IMG_SRC_ATTR = /<img\b([^>]*?)(?:^|\s)src=["']([^"']+)["']([^>]*)>/gi;

function collectImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(new RegExp(IMG_SRC_ATTR.source, 'gi'))) {
    const src = match[2]?.trim();
    if (!src || seen.has(src) || src.startsWith('data:')) {
      continue;
    }
    seen.add(src);
    srcs.push(src);
  }
  return srcs;
}

function parseLivePage(html: string): ParsedLive | null {
  const article = extractArticle(html);
  if (!article) {
    return null;
  }
  const { title, heroSrc, heroAlt, body } = stripChrome(article);
  const imageSrcs = collectImageSrcs(body);
  if (heroSrc) {
    imageSrcs.unshift(heroSrc);
  }
  return { title, heroSrc, heroAlt, bodyHtml: body, imageSrcs: [...new Set(imageSrcs)] };
}

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; html: string }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }).catch(() => null);
  if (!response) {
    return { ok: false, status: 0, html: '' };
  }
  const html = await response.text();
  return { ok: response.ok, status: response.status, html };
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }).catch((error: unknown) => {
    console.warn(`    fetch failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  if (!response?.ok) {
    return null;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    return null;
  }
  const body = Buffer.from(await response.arrayBuffer());
  return body.length ? body : null;
}

function localUploadPath(publicUrl: string): string {
  const relative = decodeURIComponent(publicUrl.replace(/^\/+/, ''));
  const target = path.resolve(PATHS.public, relative);
  if (!target.startsWith(`${PATHS.uploads}${path.sep}`)) {
    throw new Error(`Refusing to write outside uploads: ${publicUrl}`);
  }
  return target;
}

function liveAssetUrl(pageKey: string, remoteSrc: string, extension: '.webp' | '.png'): string {
  const base = path.posix.basename(remoteSrc.split('?')[0] ?? 'image');
  const stem = slugify(base.replace(/\.[^.]+$/, '')) || 'image';
  return `/uploads/legacy/live/${pageKey}/${stem}${extension}`;
}

async function processAndSave(
  buffer: Buffer,
  publicUrl: string,
  preset: ImagePreset,
  force: boolean
): Promise<{ url: string; width: number; height: number } | null> {
  const target = localUploadPath(publicUrl);
  if (!force && existsSync(target)) {
    return { url: publicUrl, width: 0, height: 0 };
  }
  try {
    const image = await imageProcessingService.process(buffer, preset, publicUrl);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, image.main.buffer);
    if (image.thumb) {
      await writeFile(localUploadPath(thumbUrl(publicUrl)), image.thumb.buffer);
    }
    return { url: publicUrl, width: image.main.width, height: image.main.height };
  } catch (error) {
    console.warn(`    process failed ${publicUrl}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function mirrorImage(
  siteUrl: string,
  pageKey: string,
  remoteSrc: string,
  preset: ImagePreset,
  cache: Map<string, string>
): Promise<{ local: string; width: number; height: number } | null> {
  const absolute = absoluteLiveUrl(siteUrl, remoteSrc);
  const cached = cache.get(absolute);
  if (cached) {
    return { local: cached, width: 0, height: 0 };
  }
  const tentative = liveAssetUrl(pageKey, remoteSrc, '.webp');
  if (!FORCE && existsSync(localUploadPath(tentative))) {
    cache.set(absolute, tentative);
    return { local: tentative, width: 0, height: 0 };
  }
  const buffer = await fetchBuffer(absolute);
  if (!buffer) {
    console.warn(`    missing image ${absolute}`);
    return null;
  }
  const saved = await processAndSave(buffer, tentative, preset, FORCE);
  if (!saved) {
    return null;
  }
  // process may change extension (favicon png); our URLs are always webp for rasters
  const local = tentative;
  cache.set(absolute, local);
  return { local, width: saved.width, height: saved.height };
}

function rewriteBodyImages(html: string, map: Map<string, string>): string {
  return html.replace(new RegExp(IMG_SRC_ATTR.source, 'gi'), (whole, _pre: string, src: string, _post: string) => {
    const local = map.get(src) ?? map.get(decodeHtmlEntities(src));
    if (!local) {
      return whole;
    }
    const alt = whole.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
    const widthMatch = whole.match(/(?:^|\s)width=["']?(\d+)/i);
    const heightMatch = whole.match(/(?:^|\s)height=["']?(\d+)/i);
    const dims =
      widthMatch && heightMatch ? ` width="${widthMatch[1]}" height="${heightMatch[1]}"` : '';
    return `<img src="${local}" alt="${alt}" loading="lazy"${dims}>`;
  });
}

function isThin(html: string): boolean {
  return toPlainText(html).length < THIN_CHARS;
}

function countImgs(html: string): number {
  return (html.match(/<img\b/gi) ?? []).length;
}

function shouldReplaceContent(local: string, liveHtml: string): boolean {
  const livePlain = toPlainText(liveHtml);
  if (FORCE) {
    return livePlain.length > 0;
  }
  if (isThin(local)) {
    return livePlain.length > 0;
  }
  if (livePlain.length > toPlainText(local).length) {
    return true;
  }
  // Prefer live product grids when they carry substantially more imagery
  return countImgs(liveHtml) > countImgs(local) + 2;
}

function nextPageId(pages: Page[]): number {
  return pages.reduce((max, page) => Math.max(max, page.id), 0) + 1;
}

function nextImageId(images: PageImage[]): number {
  return images.reduce((max, image) => Math.max(max, image.id), 0) + 1;
}

function findMenuItem(items: MenuItem[], pageId: number): MenuItem | null {
  for (const item of items) {
    if (item.pageId === pageId) {
      return item;
    }
    const child = findMenuItem(item.children, pageId);
    if (child) {
      return child;
    }
  }
  return null;
}

function findMenuByPageKey(menus: Menu[], pages: Page[], key: string): MenuItem | null {
  const page = pages.find((entry) => entry.key === key);
  if (!page) {
    return null;
  }
  for (const menu of menus) {
    const found = findMenuItem(menu.items, page.id);
    if (found) {
      return found;
    }
  }
  return null;
}

function pagePublicPath(pages: Page[], page: Page): string {
  const parts: string[] = [page.slug];
  let parentId = page.parentId;
  const byId = new Map(pages.map((entry) => [entry.id, entry]));
  while (parentId !== null) {
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    parts.unshift(parent.slug);
    parentId = parent.parentId;
  }
  return `/${parts.join('/')}`;
}

function ensureMenuChild(parent: MenuItem, child: MenuItem): void {
  if (parent.children.some((entry) => entry.pageId === child.pageId || entry.url === child.url)) {
    return;
  }
  parent.children.push(child);
}

function createPage(pages: Page[], target: LiveTarget, parent: Page): Page {
  const now = new Date().toISOString();
  const page: Page = {
    id: nextPageId(pages),
    key: target.key,
    parentId: parent.id,
    slug: target.key,
    title: target.create!.title,
    header: target.create!.title,
    summary: '',
    content: '',
    status: 'published',
    kind: target.create!.kind ?? 'page',
    sort: target.create!.sort ?? 2024,
    icon: '',
    heroImage: '',
    heroVideo: '',
    seo: { title: target.create!.title, description: '', keywords: '' },
    createdAt: now,
    updatedAt: now
  };
  pages.push(page);
  return page;
}

async function main(): Promise<void> {
  const config = await loadTransformConfig();
  const siteUrl = config.legacySiteUrl.replace(/\/$/, '');
  const pages = pagesFileSchema.parse(JSON.parse(await readFile(DATA_FILES.pages, 'utf8')));
  const images = pageImagesFileSchema.parse(JSON.parse(await readFile(DATA_FILES.pageImages, 'utf8')));
  const menus = menusFileSchema.parse(JSON.parse(await readFile(DATA_FILES.menus, 'utf8')));
  const byKey = () => new Map(pages.map((page) => [page.key, page]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of TARGETS) {
    const liveUrl = `${siteUrl}${target.livePath}`;
    console.info(`\n→ ${target.key} ← ${target.livePath}`);
    const response = await fetchHtml(liveUrl);
    if (!response.ok) {
      console.warn(`  skip HTTP ${response.status}`);
      skipped += 1;
      continue;
    }
    const parsed = parseLivePage(response.html);
    if (!parsed || toPlainText(parsed.bodyHtml).length === 0) {
      console.warn('  skip: no usable article body');
      skipped += 1;
      continue;
    }

    let page = byKey().get(target.key);
    if (!page && target.create) {
      const parent = byKey().get(target.create.parentKey);
      if (!parent) {
        console.warn(`  skip: missing parent ${target.create.parentKey}`);
        failed += 1;
        continue;
      }
      page = createPage(pages, target, parent);
      created += 1;
      console.info(`  created page #${page.id}`);
      const parentMenu = findMenuByPageKey(menus, pages, target.create.parentKey);
      if (parentMenu) {
        ensureMenuChild(parentMenu, {
          id: `m-live-${page.id}`,
          title: page.title,
          url: pagePublicPath(pages, page),
          pageId: page.id,
          sort: page.sort,
          active: true,
          htmlContent: '',
          children: []
        });
        console.info(`  menu item under ${target.create.parentKey}`);
      }
    }
    if (!page) {
      console.warn('  skip: page missing and not creatable');
      skipped += 1;
      continue;
    }

    const livePlain = toPlainText(parsed.bodyHtml);
    const replaceContent = shouldReplaceContent(page.content, parsed.bodyHtml);
    const replaceHero = FORCE || !page.heroImage;
    const existingGallery = images.filter((image) => image.pageId === page.id);
    // Skip a separate gallery when the body already carries a product image grid
    const contentHasGrid = countImgs(page.content) > 3;
    const replaceGallery = !contentHasGrid && (FORCE || existingGallery.length === 0);

    if (!replaceContent && !replaceHero && !replaceGallery) {
      console.info('  unchanged (use --force to overwrite)');
      skipped += 1;
      continue;
    }

    const urlMap = new Map<string, string>();
    const cache = new Map<string, string>();
    const dims = new Map<string, { width: number; height: number }>();

    for (const remote of parsed.imageSrcs) {
      const preset: ImagePreset = remote === parsed.heroSrc ? 'hero' : 'content';
      const mirrored = await mirrorImage(siteUrl, page.key, remote, preset, cache);
      if (!mirrored) {
        continue;
      }
      urlMap.set(remote, mirrored.local);
      if (mirrored.width > 0) {
        dims.set(mirrored.local, { width: mirrored.width, height: mirrored.height });
      }
    }

    let dirty = false;
    if (replaceContent) {
      let body = rewriteBodyImages(parsed.bodyHtml, urlMap);
      // Drop images that failed to mirror
      body = body.replace(/<img\b[^>]*?\bsrc=["'](\/images\/public\/[^"']+|\/Prv\/[^"']+)["'][^>]*>/gi, '');
      body = sanitizeRichText(body);
      // Stamp width/height when known
      body = body.replace(new RegExp(IMG_SRC_ATTR.source, 'gi'), (whole, _pre: string, src: string) => {
        const size = dims.get(src);
        if (!size || /(?:^|\s)width=/.test(whole)) {
          return whole;
        }
        const alt = whole.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
        return `<img src="${src}" alt="${alt}" loading="lazy" width="${size.width}" height="${size.height}">`;
      });
      page.content = body;
      page.summary = excerpt(body, 280);
      page.seo.description = excerpt(body, 300);
      if (parsed.title && (!page.title || page.title.length < 3)) {
        page.title = parsed.title;
        page.header = parsed.title;
        page.seo.title = parsed.title;
      }
      dirty = true;
      console.info(`  content ← live (${livePlain.length} chars)`);
      // Avoid duplicating a product image grid in both body and gallery
      if (countImgs(page.content) > 3) {
        for (let i = images.length - 1; i >= 0; i -= 1) {
          if (images[i]?.pageId === page.id) {
            images.splice(i, 1);
          }
        }
        console.info('  gallery cleared (images live in content)');
      }
    }

    if (replaceHero && parsed.heroSrc) {
      const localHero = urlMap.get(parsed.heroSrc);
      if (localHero) {
        // Re-process as hero preset if we only have content size
        const heroUrl = liveAssetUrl(page.key, `hero-${path.posix.basename(parsed.heroSrc)}`, '.webp');
        if (localHero !== heroUrl && (FORCE || !existsSync(localUploadPath(heroUrl)))) {
          const buffer = await fetchBuffer(absoluteLiveUrl(siteUrl, parsed.heroSrc));
          if (buffer) {
            const saved = await processAndSave(buffer, heroUrl, 'hero', FORCE);
            if (saved) {
              page.heroImage = heroUrl;
              dirty = true;
            }
          }
        }
        if (!page.heroImage) {
          page.heroImage = localHero;
          dirty = true;
        }
        console.info(`  hero ← ${page.heroImage}`);
      }
    } else if (replaceHero && !page.heroImage) {
      // First content image as hero fallback
      const first = [...urlMap.values()][0];
      if (first) {
        page.heroImage = first;
        dirty = true;
        console.info(`  hero ← first image ${first}`);
      }
    }

    if (replaceGallery) {
      // Build gallery from distinct content images (skip the hero figure duplicate)
      const gallerySrcs = [...urlMap.entries()]
        .filter(([remote]) => remote !== parsed.heroSrc)
        .map(([, local]) => local);
      const unique = [...new Set(gallerySrcs)];
      if (unique.length) {
        // Remove previous gallery rows for this page
        for (let i = images.length - 1; i >= 0; i -= 1) {
          if (images[i]?.pageId === page.id) {
            images.splice(i, 1);
          }
        }
        let sort = 1000;
        const now = new Date().toISOString();
        for (const src of unique) {
          const size = dims.get(src);
          images.push({
            id: nextImageId(images),
            pageId: page.id,
            sort,
            caption: '',
            src,
            width: size?.width ?? null,
            height: size?.height ?? null,
            createdAt: now
          });
          sort += 1000;
        }
        dirty = true;
        console.info(`  gallery ← ${unique.length} images`);
      }
    }

    if (dirty) {
      page.updatedAt = new Date().toISOString();
      updated += 1;
    }
  }

  // Also enrich any other published page under products/services that is thin and has a plausible live twin
  for (const page of pages) {
    if (TARGETS.some((target) => target.key === page.key)) {
      continue;
    }
    if (page.status !== 'published' || !['page', 'section'].includes(page.kind)) {
      continue;
    }
    if (!isThin(page.content)) {
      continue;
    }
    const livePath = pagePublicPath(pages, page);
    // Skip dump-only brands the plan says to leave alone when live 404s
    if (/landoll|agriculture|dynapac|heli/i.test(page.key)) {
      continue;
    }
    const response = await fetchHtml(`${siteUrl}${livePath}`);
    if (!response.ok) {
      continue;
    }
    const parsed = parseLivePage(response.html);
    if (!parsed || toPlainText(parsed.bodyHtml).length < THIN_CHARS) {
      continue;
    }
    console.info(`\n→ auto ${page.key} ← ${livePath}`);
    TARGETS.push({ key: page.key, livePath });
    // Re-enter loop logic by processing inline (simplified)
    const urlMap = new Map<string, string>();
    const cache = new Map<string, string>();
    for (const remote of parsed.imageSrcs) {
      const mirrored = await mirrorImage(siteUrl, page.key, remote, remote === parsed.heroSrc ? 'hero' : 'content', cache);
      if (mirrored) {
        urlMap.set(remote, mirrored.local);
      }
    }
    let body = sanitizeRichText(rewriteBodyImages(parsed.bodyHtml, urlMap));
    body = body.replace(/<img\b[^>]*?\bsrc=["'](\/images\/public\/[^"']+|\/Prv\/[^"']+)["'][^>]*>/gi, '');
    page.content = body;
    page.summary = excerpt(body, 280);
    page.seo.description = excerpt(body, 300);
    if (parsed.heroSrc && urlMap.has(parsed.heroSrc) && (FORCE || !page.heroImage)) {
      page.heroImage = urlMap.get(parsed.heroSrc)!;
    }
    page.updatedAt = new Date().toISOString();
    updated += 1;
    console.info(`  content ← live (${toPlainText(body).length} chars)`);
  }

  await writeFile(DATA_FILES.pages, `${JSON.stringify(pagesFileSchema.parse(pages), null, 2)}\n`, 'utf8');
  await writeFile(DATA_FILES.pageImages, `${JSON.stringify(pageImagesFileSchema.parse(images), null, 2)}\n`, 'utf8');
  await writeFile(DATA_FILES.menus, `${JSON.stringify(menusFileSchema.parse(menus), null, 2)}\n`, 'utf8');

  console.info(`\nDone. created=${created} updated=${updated} skipped=${skipped} failed=${failed}${FORCE ? ' (force)' : ''}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
