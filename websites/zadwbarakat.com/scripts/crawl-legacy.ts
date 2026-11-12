/**
 * Crawls the live legacy site into structured JSON (content/crawl/pages.json) for the importer.
 * Raw HTML is cached under content/crawl-cache, so reruns work offline; pass --refresh to fetch again.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import {
  type Coverage,
  type CrawledPage,
  type CrawlHymn,
  type CrawlListingItem,
  legacyIdFromPath,
  normalizeLegacyPath
} from './lib/crawl-model.js';

interface CacheEntry {
  status: number;
  finalPath: string;
  file: string | null;
}

const refresh = process.argv.includes('--refresh');
const SKIPPED_PREFIXES = ['/prv/', '/images/', '/skins/', '/plugins/', '/js/', '/_cms', '/search', '/downloads/', '/landing-page', '/temp/', '/test/'];
const ASSET_EXTENSION = /\.(jpe?g|png|gif|webp|svg|ico|mp3|mp4|pdf|docx?|xlsx?|zip|css|js|xml|aspx|ashx)$/i;
const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(element: HTMLElement | null | undefined): string {
  return (element?.text ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function queueKey(pathName: string, pageNumber: number): string {
  return pageNumber > 1 ? `${pathName}?p=${pageNumber}` : pathName;
}

class Crawler {
  private readonly queue: { path: string; page: number }[] = [];
  private readonly seen = new Set<string>();
  private readonly results = new Map<string, CrawledPage>();
  private cache: Record<string, CacheEntry> = {};
  private nextSlot = 0;
  private fetched = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly hosts: Set<string>,
    private readonly cacheDir: string,
    private readonly delayMs: number,
    private readonly userAgent: string
  ) {}

  public async loadCache(): Promise<void> {
    const indexPath = path.join(this.cacheDir, 'index.json');
    if (!refresh && existsSync(indexPath)) {
      this.cache = JSON.parse(await readFile(indexPath, 'utf8')) as Record<string, CacheEntry>;
    }
  }

  public async saveCache(): Promise<void> {
    await writeFile(path.join(this.cacheDir, 'index.json'), `${JSON.stringify(this.cache, null, 1)}\n`, 'utf8');
  }

  public enqueue(rawPath: string, page = 1): void {
    const pathName = normalizeLegacyPath(rawPath);
    const lower = pathName.toLowerCase();
    if (SKIPPED_PREFIXES.some((prefix) => lower.startsWith(prefix) || `${lower}/` === prefix) || ASSET_EXTENSION.test(lower)) {
      return;
    }
    const key = queueKey(pathName, page);
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.queue.push({ path: pathName, page });
  }

  /** Returns an internal path for a link, or null when it points elsewhere. */
  public internalPath(href: string): string | null {
    const value = href.trim();
    if (!value || value.startsWith('#') || /^(mailto|tel|javascript):/i.test(value)) {
      return null;
    }
    if (value.startsWith('/')) {
      return value.startsWith('//') ? this.internalPath(`https:${value}`) : value;
    }
    try {
      const url = new URL(value);
      return this.hosts.has(url.hostname.toLowerCase()) ? `${url.pathname}${url.search}` : null;
    } catch {
      return null;
    }
  }

  public async run(workers: number): Promise<CrawledPage[]> {
    let active = 0;
    await new Promise<void>((resolve, reject) => {
      const pump = (): void => {
        if (this.queue.length === 0 && active === 0) {
          resolve();
          return;
        }
        while (active < workers && this.queue.length > 0) {
          const job = this.queue.shift();
          if (!job) {
            break;
          }
          active += 1;
          this.process(job.path, job.page)
            .then(() => {
              active -= 1;
              pump();
            })
            .catch(reject);
        }
      };
      pump();
    });
    await this.saveCache();
    return [...this.results.values()];
  }

  private async process(pathName: string, page: number): Promise<void> {
    const key = queueKey(pathName, page);
    const { status, html, finalPath } = await this.fetchPage(pathName, page);
    if (status !== 200 || !html) {
      this.results.set(key, this.emptyPage(pathName, page, status, finalPath));
      return;
    }
    const parsed = this.parsePage(pathName, page, finalPath, html);
    this.results.set(key, parsed);
    for (const link of parsed.links) {
      this.enqueue(link);
    }
    if (page === 1 && parsed.lastPageNumber > 1) {
      for (let next = 2; next <= parsed.lastPageNumber; next += 1) {
        this.enqueue(pathName, next);
      }
    }
    if (this.results.size % 50 === 0) {
      console.info(`  ${this.results.size} pages parsed, ${this.queue.length} queued, ${this.fetched} fetched from the network`);
      await this.saveCache();
    }
  }

  private async fetchPage(pathName: string, page: number): Promise<{ status: number; html: string | null; finalPath: string }> {
    const key = queueKey(pathName, page);
    const cached = this.cache[key];
    if (cached) {
      if (cached.file && existsSync(path.join(this.cacheDir, cached.file))) {
        return { status: cached.status, html: await readFile(path.join(this.cacheDir, cached.file), 'utf8'), finalPath: cached.finalPath };
      }
      if (!cached.file && cached.status !== 0) {
        return { status: cached.status, html: null, finalPath: cached.finalPath };
      }
    }
    const url = `${this.baseUrl}${encodeURI(pathName)}${page > 1 ? `?p=${page}` : ''}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const wait = this.nextSlot - Date.now();
      this.nextSlot = Math.max(Date.now(), this.nextSlot) + this.delayMs;
      if (wait > 0) {
        await sleep(wait);
      }
      try {
        const response = await fetch(url, { headers: { 'user-agent': this.userAgent, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(45_000) });
        this.fetched += 1;
        const finalPath = normalizeLegacyPath(new URL(response.url).pathname);
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          await sleep(1500 * attempt);
          continue;
        }
        if (response.status !== 200) {
          this.cache[key] = { status: response.status, finalPath, file: null };
          return { status: response.status, html: null, finalPath };
        }
        const html = await response.text();
        const file = `${createHash('sha1').update(key).digest('hex')}.html`;
        await writeFile(path.join(this.cacheDir, file), html, 'utf8');
        this.cache[key] = { status: 200, finalPath, file };
        return { status: 200, html, finalPath };
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          console.warn(`  ! ${key}: ${(error as Error).message}`);
          return { status: 0, html: null, finalPath: pathName };
        }
        await sleep(2000 * attempt);
      }
    }
    return { status: 0, html: null, finalPath: pathName };
  }

  private emptyPage(pathName: string, page: number, status: number, finalPath: string): CrawledPage {
    return {
      path: pathName,
      pageNumber: page,
      status,
      finalPath,
      title: '',
      bodyHtml: '',
      listing: [],
      lastPageNumber: 1,
      hymns: [],
      hymnCategories: [],
      albumImages: [],
      isAlbum: false,
      youtubeId: '',
      videoThumbs: [],
      links: []
    };
  }

  private parsePage(pathName: string, page: number, finalPath: string, html: string): CrawledPage {
    const root = parse(html, { comment: false });
    // Legacy pages wrap filters in unclosed ASP.NET forms, which can push the article out of the parsed tree.
    const article = root.querySelector('section.content article') ?? root.querySelector('section.content') ?? (root.querySelector('table.mp3-list') ? root : null);
    const links = new Set<string>();
    for (const anchor of root.querySelectorAll('a[href]')) {
      const internal = this.internalPath(anchor.getAttribute('href') ?? '');
      if (internal && !internal.startsWith('?')) {
        links.add(internal.split('?')[0] ?? internal);
      }
    }

    const result = this.emptyPage(pathName, page, 200, finalPath);
    result.links = [...links];
    if (!article) {
      return result;
    }
    result.title = text(article.querySelector('h1'));
    result.listing = article.querySelectorAll('ul.page-list > li').map((item): CrawlListingItem => {
      const link = item.querySelector('a.details') ?? item.querySelector('a[href]');
      const image = item.querySelector('img')?.getAttribute('src') ?? '';
      return {
        path: normalizeLegacyPath(this.internalPath(link?.getAttribute('href') ?? '') ?? ''),
        title: text(item.querySelector('h2')) || (link?.getAttribute('title') ?? '').trim(),
        summary: text(item.querySelector('p')),
        image,
        legacyId: legacyIdFromPath(image)
      };
    });

    const pager = article.querySelectorAll('.pager a[href]').map((anchor) => /[?&]p=(\d+)/.exec(anchor.getAttribute('href') ?? '')?.[1]);
    result.lastPageNumber = Math.max(1, ...pager.filter((value): value is string => Boolean(value)).map((value) => Number.parseInt(value, 10)));

    const hymnRows = root.querySelectorAll('table.mp3-list tbody tr');
    result.hymns = hymnRows.map((row): CrawlHymn => {
      const cells = row.querySelectorAll('td');
      const file = cells[1]?.querySelector('a')?.getAttribute('href') ?? '';
      return {
        legacyId: legacyIdFromPath(file),
        title: text(cells[1]),
        file,
        singer: text(cells[2]),
        author: text(cells[3]),
        album: text(cells[4]),
        category: text(cells[5])
      };
    });
    const categorySelect = root.querySelectorAll('select').find((select) => /Taratil$/.test(select.getAttribute('name') ?? ''));
    result.hymnCategories = (categorySelect?.querySelectorAll('option') ?? []).map((option) => text(option)).filter(Boolean);

    result.isAlbum = Boolean(article.querySelector('h1.album-images-title'));
    result.albumImages = article.querySelectorAll('a.magnificPopup').map((anchor) => anchor.getAttribute('href') ?? '').filter(Boolean);

    const iframe = article.querySelector('iframe[src*="youtube"]');
    result.youtubeId = /embed\/([\w-]{6,20})/.exec(iframe?.getAttribute('src') ?? '')?.[1] ?? '';
    if (iframe) {
      result.videoThumbs = article.querySelectorAll('.albums a.thumbnail').map((anchor) => ({
        path: normalizeLegacyPath(anchor.getAttribute('href') ?? ''),
        title: text(anchor.querySelector('span')) || (anchor.querySelector('img')?.getAttribute('alt') ?? '').trim(),
        image: (anchor.querySelector('img')?.getAttribute('src') ?? '').replace(/\\/g, '/')
      }));
    }

    const body = article.querySelector('.small-article');
    if (body) {
      for (const removable of body.querySelectorAll('script, style, form, .share, .search-bar, .product-list, .albums, .embed-responsive, table.mp3-list, .pager')) {
        removable.remove();
      }
      result.bodyHtml = body.innerHTML.trim();
    }
    return result;
  }
}

async function numberedFolders(folder: string, prefix: string): Promise<number[]> {
  if (!existsSync(folder)) {
    return [];
  }
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((entry) => Number.parseInt(entry.name.slice(prefix.length), 10))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);
}

async function main(): Promise<void> {
  const config = await loadTransformConfig();
  const cacheDir = resolveFromSite(config.crawl.cacheDir);
  const outputDir = resolveFromSite(config.crawl.outputDir);
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const baseUrl = config.legacySiteUrl.replace(/\/$/, '');
  const hosts = new Set([new URL(baseUrl).hostname, ...config.legacy.legacyHosts].map((host) => host.toLowerCase()));
  const crawler = new Crawler(baseUrl, hosts, cacheDir, config.crawl.delayMs, config.crawl.userAgent);
  await crawler.loadCache();
  for (const seed of config.crawl.seeds) {
    crawler.enqueue(seed);
  }
  console.info(`Crawling ${baseUrl} with ${config.crawl.concurrency} workers, ${config.crawl.delayMs} ms apart${refresh ? ' (refresh)' : ''}...`);
  const pages = (await crawler.run(config.crawl.concurrency)).sort((a, b) => a.path.localeCompare(b.path) || a.pageNumber - b.pageNumber);
  await writeFile(path.join(outputDir, 'pages.json'), `${JSON.stringify(pages, null, 1)}\n`, 'utf8');

  const ids = new Set<number>();
  for (const page of pages) {
    for (const item of page.listing) {
      if (item.legacyId !== null) {
        ids.add(item.legacyId);
      }
    }
    for (const hymn of page.hymns) {
      if (hymn.legacyId !== null) {
        ids.add(hymn.legacyId);
      }
    }
    for (const match of page.bodyHtml.matchAll(/Page_(\d+)/gi)) {
      ids.add(Number.parseInt(match[1] ?? '0', 10));
    }
  }
  const albums = new Set<number>();
  for (const page of pages) {
    for (const image of page.albumImages) {
      const id = /Album(\d+)/i.exec(image)?.[1];
      if (id) {
        albums.add(Number.parseInt(id, 10));
      }
    }
  }
  const localRoot = config.legacy.localRoot ? resolveFromSite(config.legacy.localRoot) : null;
  const pageFolders = localRoot ? await numberedFolders(path.join(localRoot, 'PRV', 'Images', 'Pages'), 'Page_') : [];
  const albumFolders = localRoot ? await numberedFolders(path.join(localRoot, 'PRV', 'Images', 'PhotoAlbums'), 'Album') : [];
  const coverage: Coverage = {
    crawledAt: new Date().toISOString(),
    pagesFetched: pages.filter((page) => page.status === 200).length,
    pagesFailed: pages.filter((page) => page.status !== 200).map((page) => ({ path: queueKey(page.path, page.pageNumber), status: page.status })),
    legacyPageIdsFound: ids.size,
    localPageFolders: pageFolders.length,
    unreachablePageFolders: pageFolders.filter((id) => !ids.has(id)),
    localAlbumFolders: albumFolders.length,
    albumsFound: [...albums].sort((a, b) => a - b),
    unreachableAlbumFolders: albumFolders.filter((id) => !albums.has(id))
  };
  await writeFile(path.join(outputDir, 'coverage.json'), `${JSON.stringify(coverage, null, 1)}\n`, 'utf8');
  console.info(
    `Done: ${coverage.pagesFetched} pages, ${coverage.pagesFailed.length} failed, ${coverage.legacyPageIdsFound} legacy page ids found ` +
      `(${coverage.unreachablePageFolders.length} of ${coverage.localPageFolders} local page folders not linked), ` +
      `${coverage.albumsFound.length} albums (${coverage.unreachableAlbumFolders.length} of ${coverage.localAlbumFolders} album folders not linked).`
  );
}

await main();
