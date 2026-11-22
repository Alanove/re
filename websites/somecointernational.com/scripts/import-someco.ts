/**
 * Import Someco International from the MySQL dump and local wwwroot.
 * Usage: npm run import:legacy [-- --force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import type { Home, Menu, MenuItem, Office, Page, PageImage, Redirect, Settings } from '../src/domain/models.js';
import { imageProcessingService, type ImagePreset } from '../src/services/imageProcessingService.js';
import { sanitizeRichText } from '../src/services/sanitizeService.js';

const force = process.argv.includes('--force');

interface DumpPage {
  id: number;
  parentId: number | null;
  url: string;
  title: string;
  description: string | null;
  content: string | null;
  status: number;
  image: string | null;
  ranking: number | null;
  keywords: string | null;
  dateCreated: string;
  dateModified: string;
  state: number | null;
}

interface DumpMenu {
  id: number;
  title: string;
  url: string;
  pageId: number | null;
  sorting: number;
  menuId: number | null;
  state: number;
  htmlContent: string | null;
}

interface DumpPicture {
  id: number;
  pageId: number;
  fileName: string;
  caption: string;
  sort: number;
}

interface DumpSlide {
  id: number;
  pageId: number | null;
  fileName: string;
  description: string;
  sort: number;
  buttonText: string | null;
}

function sqlUnquote(value: string): string | null {
  if (value === 'NULL') {
    return null;
  }
  if (!(value.startsWith("'") && value.endsWith("'"))) {
    return value;
  }
  return value
    .slice(1, -1)
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\0/g, '\0')
    .replace(/\\Z/g, '\x1a');
}

function splitSqlValues(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inString = false;
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    const next = body[i + 1];
    if (inString) {
      current += ch;
      if (ch === '\\' && next) {
        current += next;
        i += 1;
        continue;
      }
      if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === '(') {
      if (depth === 0) {
        row = [];
        current = '';
        depth = 1;
        continue;
      }
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        row.push(current.trim());
        rows.push(row);
        current = '';
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 1) {
      row.push(current.trim());
      current = '';
      continue;
    }
    if (depth >= 1) {
      current += ch;
    }
  }
  return rows;
}

function extractInsert(dump: string, table: string): string[][] {
  const marker = `INSERT INTO \`${table}\` VALUES `;
  const start = dump.indexOf(marker);
  if (start === -1) {
    return [];
  }
  const from = start + marker.length;
  const end = dump.indexOf(';\n', from);
  const body = dump.slice(from, end === -1 ? dump.length : end);
  return splitSqlValues(body);
}

function asInt(value: string | null): number | null {
  if (value === null || value === '') {
    return null;
  }
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function asIso(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function legacyMenuPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+/g, '/').toLowerCase();
}

function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page';
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureWritable(filePath: string, label: string): void {
  if (existsSync(filePath) && !force) {
    throw new Error(`${label} already exists. Re-run with --force to overwrite.`);
  }
}

async function processLocalImage(sourcePath: string, destRel: string, preset: ImagePreset): Promise<{ url: string; width: number; height: number } | null> {
  if (!existsSync(sourcePath)) {
    return null;
  }
  const buffer = await readFile(sourcePath);
  const processed = await imageProcessingService.process(buffer, preset);
  const abs = path.join(PATHS.public, destRel.replace(/^\/+/, ''));
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, processed.main.buffer);
  if (processed.thumb) {
    const thumbAbs = abs.replace(/\.webp$/i, '-thumb.webp');
    await writeFile(thumbAbs, processed.thumb.buffer);
  }
  return { url: destRel.replace(/\\/g, '/'), width: processed.main.width, height: processed.main.height };
}

function candidateImagePaths(wwwRoot: string, pageSlug: string, fileName: string, kind: 'hero' | 'gallery' | 'slide'): string[] {
  const names = [fileName];
  if (!/\.webp$/i.test(fileName)) {
    names.push(fileName.replace(/\.[^.]+$/, '.webp'));
  }
  const paths: string[] = [];
  const pageSlugs = [pageSlug, `${pageSlug}-1`];
  for (const name of names) {
    for (const slug of pageSlugs) {
      if (kind === 'slide') {
        paths.push(path.join(wwwRoot, 'pages', slug, 'slideshow', 'large', name));
        paths.push(path.join(wwwRoot, 'pages', slug, 'slideshow', name));
      }
      if (kind === 'gallery') {
        paths.push(path.join(wwwRoot, 'pages', slug, 'gallery', 'large', name));
        paths.push(path.join(wwwRoot, 'pages', slug, 'gallery', name));
      }
      paths.push(path.join(wwwRoot, 'pages', slug, name));
    }
    paths.push(path.join(wwwRoot, 'img', name));
    paths.push(path.join(wwwRoot, 'images', name));
    paths.push(path.join(wwwRoot, 'files', 'fast-upload', name));
  }
  return paths;
}

async function findAndProcess(
  wwwRoot: string,
  pageSlug: string,
  fileName: string,
  destRel: string,
  preset: ImagePreset,
  kind: 'hero' | 'gallery' | 'slide'
): Promise<{ url: string; width: number; height: number } | null> {
  for (const candidate of candidateImagePaths(wwwRoot, pageSlug, fileName, kind)) {
    const processed = await processLocalImage(candidate, destRel, preset);
    if (processed) {
      return processed;
    }
  }
  return null;
}

function rewriteHtml(html: string, urlMap: Map<string, string>): string {
  let next = html;
  for (const [from, to] of urlMap) {
    next = next.split(from).join(to);
  }
  return sanitizeRichText(next);
}

async function main(): Promise<void> {
  const config = await loadTransformConfig();
  const dumpRel = config.legacy.dbDump ?? 'legacy/db/db';
  const dumpPath = resolveFromSite(dumpRel);
  const wwwRoot = resolveFromSite(config.legacy.localRoot ?? '');
  if (!existsSync(dumpPath)) {
    throw new Error(`MySQL dump not found at ${dumpPath}`);
  }
  if (!existsSync(wwwRoot)) {
    throw new Error(`Legacy wwwroot not found at ${wwwRoot}`);
  }

  for (const file of [DATA_FILES.pages, DATA_FILES.pageImages, DATA_FILES.menus, DATA_FILES.home, DATA_FILES.settings, DATA_FILES.offices, DATA_FILES.redirects]) {
    ensureWritable(file, path.basename(file));
  }

  const dump = await readFile(dumpPath, 'utf8');
  const now = new Date().toISOString();

  const dumpPages: DumpPage[] = extractInsert(dump, 'pages').map((cols) => ({
    id: asInt(sqlUnquote(cols[0]))!,
    parentId: asInt(sqlUnquote(cols[1])),
    url: (sqlUnquote(cols[2]) ?? '').toLowerCase(),
    title: sqlUnquote(cols[3]) ?? 'Untitled',
    description: sqlUnquote(cols[4]),
    content: sqlUnquote(cols[5]),
    status: asInt(sqlUnquote(cols[6])) ?? 0,
    image: sqlUnquote(cols[7]),
    ranking: asInt(sqlUnquote(cols[9])),
    keywords: sqlUnquote(cols[14]),
    dateCreated: sqlUnquote(cols[16]) ?? now,
    dateModified: sqlUnquote(cols[18]) ?? now,
    state: asInt(sqlUnquote(cols[19]))
  }));

  const dumpMenus: DumpMenu[] = extractInsert(dump, 'menus').map((cols) => ({
    id: asInt(sqlUnquote(cols[0]))!,
    title: sqlUnquote(cols[1]) ?? '',
    url: sqlUnquote(cols[2]) ?? '',
    pageId: asInt(sqlUnquote(cols[3])),
    sorting: asInt(sqlUnquote(cols[5])) ?? 0,
    menuId: asInt(sqlUnquote(cols[6])),
    state: asInt(sqlUnquote(cols[11])) ?? 0,
    htmlContent: sqlUnquote(cols[14])
  }));

  const dumpPictures: DumpPicture[] = extractInsert(dump, 'pagepicture').map((cols) => ({
    id: asInt(sqlUnquote(cols[0]))!,
    pageId: asInt(sqlUnquote(cols[1]))!,
    fileName: sqlUnquote(cols[2]) ?? '',
    caption: sqlUnquote(cols[3]) ?? '',
    sort: asInt(sqlUnquote(cols[4])) ?? 0
  }));

  const dumpSlides: DumpSlide[] = extractInsert(dump, 'slideshowpicture').map((cols) => ({
    id: asInt(sqlUnquote(cols[0]))!,
    pageId: asInt(sqlUnquote(cols[2])),
    fileName: sqlUnquote(cols[3]) ?? '',
    description: sqlUnquote(cols[4]) ?? '',
    sort: asInt(sqlUnquote(cols[5])) ?? 0,
    buttonText: sqlUnquote(cols[6])
  }));

  const settingsRows = extractInsert(dump, 'websitesettings');
  const settingsMap = new Map<string, string>();
  for (const cols of settingsRows) {
    const key = sqlUnquote(cols[1]);
    const value = sqlUnquote(cols[2]) ?? '';
    if (key) {
      settingsMap.set(key, value);
    }
  }

  const websiteRow = extractInsert(dump, 'websites')[0];
  const siteName = websiteRow ? sqlUnquote(websiteRow[2]) ?? config.siteName : config.siteName;
  const siteDescription = websiteRow ? sqlUnquote(websiteRow[3]) ?? '' : '';

  const hidden = new Set(config.legacy.hiddenPageKeys);
  const pagesById = new Map(dumpPages.map((page) => [page.id, page]));

  const childrenOf = new Map<number | null, DumpPage[]>();
  for (const page of dumpPages) {
    if (page.state === 0) {
      continue;
    }
    const list = childrenOf.get(page.parentId) ?? [];
    list.push(page);
    childrenOf.set(page.parentId, list);
  }

  const urlMap = new Map<string, string>();
  const pages: Page[] = [];
  const pageImages: PageImage[] = [];
  let imageId = 1;
  let missingImages = 0;

  for (const page of dumpPages) {
    if (page.state === 0) {
      continue;
    }
    const key = slugifyKey(page.url);
    const slug = key === 'home' ? 'home' : key;
    const isHidden = hidden.has(key);
    const kids = (childrenOf.get(page.id) ?? []).filter((child) => child.state !== 0);
    let kind: Page['kind'] = 'page';
    if (key === config.legacy.contactPageKey) {
      kind = 'contact';
    } else if (key === (config.legacy.feedbackPageKey ?? 'feedback')) {
      kind = 'feedback';
    } else if (key === 'home') {
      kind = 'page';
    } else if ((!page.content || page.content.trim() === '') && kids.length > 0) {
      kind = 'section';
    }

    const destHero = `/uploads/legacy/pages/${key}/hero.webp`;
    let heroImage = '';
    if (page.image) {
      const processed = await findAndProcess(wwwRoot, key, page.image, destHero, 'hero', 'hero');
      if (processed) {
        heroImage = processed.url;
        urlMap.set(`/pages/${key}/${page.image}`, processed.url);
      } else {
        missingImages += 1;
        console.warn(`Missing hero for ${key}: ${page.image}`);
      }
    }

    let content = page.content ?? '';
    if (content) {
      const imgMatches = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/gi)];
      for (const match of imgMatches) {
        const src = match[1];
        if (!src.startsWith('/') || urlMap.has(src)) {
          continue;
        }
        const fileName = path.basename(src);
        const dest = `/uploads/legacy/inline/${key}/${slugifyKey(fileName)}.webp`;
        const sourceCandidates = [
          path.join(wwwRoot, src.replace(/^\/+/, '').replace(/\//g, path.sep)),
          path.join(wwwRoot, 'img', fileName),
          path.join(wwwRoot, 'files', 'fast-upload', fileName),
          path.join(wwwRoot, 'pages', key, fileName)
        ];
        let saved: { url: string } | null = null;
        for (const candidate of sourceCandidates) {
          saved = await processLocalImage(candidate, dest, 'content');
          if (saved) {
            break;
          }
        }
        if (saved) {
          urlMap.set(src, saved.url);
        }
      }
      content = rewriteHtml(content, urlMap);
    }

    pages.push({
      id: page.id,
      key,
      parentId: page.parentId,
      slug,
      title: page.title,
      header: page.title,
      summary: (page.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000),
      content: key === config.legacy.contactPageKey || key === (config.legacy.feedbackPageKey ?? 'feedback') ? '' : content,
      status: isHidden || page.status !== 1 ? 'draft' : 'published',
      kind,
      sort: page.ranking ?? page.id * 100,
      icon: '',
      heroImage,
      heroVideo: '',
      seo: {
        title: page.title,
        description: (page.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
        keywords: page.keywords ?? ''
      },
      createdAt: asIso(page.dateCreated, now),
      updatedAt: asIso(page.dateModified, now)
    });

    for (const picture of dumpPictures.filter((row) => row.pageId === page.id).sort((a, b) => a.sort - b.sort)) {
      const dest = `/uploads/legacy/pages/${key}/gallery/${slugifyKey(picture.fileName)}.webp`;
      const processed = await findAndProcess(wwwRoot, key, picture.fileName, dest, 'gallery', 'gallery');
      if (!processed) {
        missingImages += 1;
        console.warn(`Missing gallery image for ${key}: ${picture.fileName}`);
        continue;
      }
      pageImages.push({
        id: imageId++,
        pageId: page.id,
        sort: picture.sort,
        caption: picture.caption.slice(0, 300),
        src: processed.url,
        width: processed.width,
        height: processed.height,
        createdAt: now
      });
    }

    for (const slide of dumpSlides.filter((row) => row.pageId === page.id && page.id !== 1).sort((a, b) => a.sort - b.sort)) {
      const dest = `/uploads/legacy/pages/${key}/slides/${slugifyKey(slide.fileName)}.webp`;
      const processed = await findAndProcess(wwwRoot, key, slide.fileName, dest, 'gallery', 'slide');
      if (!processed) {
        missingImages += 1;
        continue;
      }
      pageImages.push({
        id: imageId++,
        pageId: page.id,
        sort: 50_000 + slide.sort,
        caption: slide.description.slice(0, 300),
        src: processed.url,
        width: processed.width,
        height: processed.height,
        createdAt: now
      });
    }
  }

  const homePage = pagesById.get(1);
  const whoWeAre = dumpPages.find((page) => page.url === 'who-we-are');
  const homeSlides = [];
  for (const slide of dumpSlides.filter((row) => row.pageId === 1).sort((a, b) => a.sort - b.sort)) {
    const dest = `/uploads/legacy/home/slides/${slugifyKey(slide.fileName)}.webp`;
    const processed = await findAndProcess(wwwRoot, 'home', slide.fileName, dest, 'slide', 'slide');
    if (!processed) {
      missingImages += 1;
      console.warn(`Missing home slide: ${slide.fileName}`);
      continue;
    }
    homeSlides.push({
      title: slide.description || siteName,
      label: slide.buttonText ?? '',
      url: '/about',
      image: processed.url
    });
  }

  let aboutImage = '';
  if (whoWeAre?.image) {
    const processed = await findAndProcess(wwwRoot, 'who-we-are', whoWeAre.image, '/uploads/legacy/home/about.webp', 'card', 'hero');
    if (processed) {
      aboutImage = processed.url;
    }
  }

  const home: Home = {
    hero: { enabled: homeSlides.length > 0, interval: 6, slides: homeSlides },
    about: {
      enabled: Boolean(whoWeAre?.content || whoWeAre?.description),
      title: whoWeAre?.title || 'Who We Are',
      content: rewriteHtml(whoWeAre?.content || whoWeAre?.description || '', urlMap),
      image: aboutImage
    },
    clients: {
      enabled: pageImages.some((image) => image.pageId === 1),
      title: 'Our Clients'
    },
    updatedAt: now
  };

  const activeMenus = dumpMenus.filter((item) => item.state === 1 && item.menuId !== null);
  const rootMenuId = 1;

  const pagePathById = new Map<number, string>();
  const assignPaths = (parentId: number | null, prefix: string): void => {
    for (const page of dumpPages.filter((row) => row.parentId === parentId && row.state !== 0).sort((a, b) => (a.ranking ?? 0) - (b.ranking ?? 0))) {
      const key = slugifyKey(page.url);
      const next = key === 'home' ? '/' : `${prefix}/${key}`.replace(/\/+/g, '/');
      pagePathById.set(page.id, next === '' ? '/' : next);
      assignPaths(page.id, next === '/' ? '' : next);
    }
  };
  assignPaths(null, '');

  const pageIdByPath = new Map<string, number>();
  for (const [id, pagePath] of pagePathById) {
    pageIdByPath.set(pagePath.toLowerCase(), id);
  }

  const normalizeMenuHtml = (html: string | null): string => {
    const raw = (html ?? '').trim();
    if (!raw) return '';
    // Drop Bootstrap spacing utilities on bordered CTA labels (e.g. Feedback).
    return raw
      .replace(/\s*(?:px-\d+|py-\d+|p-\d+|mx-\d+|my-\d+|m-\d+|d-inline-block)\b/g, '')
      .replace(/class="\s*"/g, '')
      .replace(/class="\s+/g, 'class="')
      .replace(/\s+"/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Match the legacy menu partial: href is the menu Url column, not PageId.
  // Home stays unlinked from the draft home page so the item is not dropped.
  const buildMenuItems = (parentId: number): MenuItem[] =>
    activeMenus
      .filter((item) => item.menuId === parentId)
      .sort((a, b) => a.sorting - b.sorting)
      .map((item) => {
        const url = legacyMenuPath(item.url);
        const matchedId = pageIdByPath.get(url) ?? null;
        const pageId = url === '/' ? null : matchedId;
        return {
          id: `m${item.id}`,
          title: item.title,
          url,
          pageId,
          sort: item.sorting,
          active: true,
          htmlContent: normalizeMenuHtml(item.htmlContent),
          children: buildMenuItems(item.id)
        };
      });

  const menus: Menu[] = [
    {
      id: 'main',
      name: 'Main Menu',
      description: 'Header and footer navigation',
      items: buildMenuItems(rootMenuId)
    }
  ];

  const seedPath = resolveFromSite(config.contentSeed);
  const seed = existsSync(seedPath) ? (JSON.parse(await readFile(seedPath, 'utf8')) as { office?: Office }) : {};

  const logoSource = path.join(wwwRoot, 'images', 'someco-international-logo.png');
  const logo = await processLocalImage(logoSource, config.logo.localPath, 'logo');
  const favicon = await processLocalImage(logoSource, '/uploads/site/favicon.png', 'favicon');

  const settings: Settings = {
    siteName,
    tagline: '',
    description: siteDescription || 'Someco International showroom and service center, Dora Highway, Beirut, Lebanon.',
    logo: logo?.url ?? '',
    favicon: favicon?.url ?? '',
    contactEmail: settingsMap.get('EmailAddress') || 'info@somecointernational.com',
    contactPhone: settingsMap.get('PhoneNumber') || '+961 1 576777',
    whatsappNumber: settingsMap.get('Whatsapp') || '',
    brochureUrl: '',
    footerText: '',
    copyright: `© ${new Date().getFullYear()} ${siteName}`,
    inquiryTopics: ['General inquiry', 'Products', 'Services', 'Feedback'],
    themeColor: '#006090',
    social: {
      facebook: settingsMap.get('Facebook') || '',
      instagram: settingsMap.get('Instagram') || '',
      linkedin: settingsMap.get('LinkedIn') || '',
      youtube: settingsMap.get('YouTube') || '',
      twitter: settingsMap.get('Twitter') || ''
    },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: {
      defaultTitle: siteName,
      defaultDescription: siteDescription,
      defaultKeywords: 'Someco International, construction equipment, industrial equipment, Lebanon',
      defaultImage: logo?.url ?? ''
    },
    updatedAt: now
  };

  const offices: Office[] = [
    seed.office ?? {
      id: 'dora',
      country: 'Lebanon',
      role: 'Showroom and service center',
      address: settingsMap.get('Address') || 'Medawar 1200 Building Beside Sukleen President Charles Helou avenue Doura Highway',
      poBox: '',
      phones: [settings.contactPhone].filter(Boolean),
      fax: settingsMap.get('Fax') || '',
      emails: [settings.contactEmail],
      mapQuery: 'Someco International Dora Highway Beirut',
      isPrimary: true,
      sort: 10
    }
  ];

  const redirects: Redirect[] = [
    { from: '/home', to: '/' },
    { from: '/default.aspx', to: '/' },
    { from: '/Default.aspx', to: '/' }
  ];
  for (const page of pages) {
    if (page.status !== 'published' || page.key === 'home') {
      continue;
    }
    const nested = pagePathById.get(page.id);
    if (nested && nested !== `/${page.key}`) {
      redirects.push({ from: `/${page.key}`, to: nested });
    }
  }

  // Drop the home page from public routing by marking it draft; home.json drives `/`.
  for (const page of pages) {
    if (page.key === 'home') {
      page.status = 'draft';
    }
  }

  await writeJson(DATA_FILES.pages, pages);
  await writeJson(DATA_FILES.pageImages, pageImages);
  await writeJson(DATA_FILES.menus, menus);
  await writeJson(DATA_FILES.home, home);
  await writeJson(DATA_FILES.settings, settings);
  await writeJson(DATA_FILES.offices, offices);
  await writeJson(DATA_FILES.redirects, redirects);

  console.info(
    JSON.stringify(
      {
        pages: pages.length,
        published: pages.filter((page) => page.status === 'published').length,
        galleries: pageImages.length,
        homeSlides: home.hero.slides.length,
        menus: menus[0]?.items.length ?? 0,
        missingImages,
        homePageTitle: homePage?.title
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
