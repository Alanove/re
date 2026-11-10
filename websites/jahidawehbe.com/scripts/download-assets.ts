import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import { thumbUrl } from '../src/domain/media.js';
import { homeSchema, pageImagesFileSchema, pagesFileSchema, settingsSchema } from '../src/domain/models.js';
import { IMAGE_PRESETS, imageProcessingService } from '../src/services/imageProcessingService.js';
import { readAssetManifest, writeAssetManifest, type AssetEntry } from './lib/asset-manifest.js';

const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 45_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; site-migration/1.0)';

interface SourceFile {
  source: string;
  body: Buffer;
}

interface SavedAsset {
  source: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

interface PruneStats {
  fields: number;
  images: number;
  references: number;
}

function isSvg(body: Buffer): boolean {
  const head = body.subarray(0, 512).toString('utf8').trimStart();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

function localFilePath(local: string): string {
  const relative = decodeURIComponent(local.replace(/^\/+/, ''));
  const target = path.resolve(PATHS.public, relative);
  if (!target.startsWith(`${PATHS.uploads}${path.sep}`)) {
    throw new Error(`Refusing to write outside public/uploads: ${local}`);
  }
  return target;
}

class LegacySource {
  private readonly listings = new Map<string, Promise<string[]>>();

  public constructor(
    private readonly localRoot: string | null,
    private readonly siteUrl: string
  ) {}

  public async read(entry: AssetEntry): Promise<SourceFile | null> {
    for (const legacyPath of entry.legacyPaths) {
      const local = await this.readLocal(legacyPath);
      if (local) {
        return local;
      }
    }
    for (const legacyPath of entry.legacyPaths) {
      const remote = await this.readRemote(legacyPath);
      if (remote) {
        return remote;
      }
    }
    return null;
  }

  private list(directory: string): Promise<string[]> {
    let listing = this.listings.get(directory);
    if (!listing) {
      listing = readdir(directory).catch(() => []);
      this.listings.set(directory, listing);
    }
    return listing;
  }

  private async readLocal(legacyPath: string): Promise<SourceFile | null> {
    if (!this.localRoot) {
      return null;
    }
    let current = this.localRoot;
    for (const segment of legacyPath.split('/').filter(Boolean)) {
      const names = await this.list(current);
      const match = names.find((name) => name === segment) ?? names.find((name) => name.toLowerCase() === segment.toLowerCase());
      if (!match) {
        return null;
      }
      current = path.join(current, match);
    }
    const info = await stat(current).catch(() => null);
    if (!info?.isFile() || info.size === 0) {
      return null;
    }
    return { source: `local:${path.relative(this.localRoot, current).split(path.sep).join('/')}`, body: await readFile(current) };
  }

  private async readRemote(legacyPath: string): Promise<SourceFile | null> {
    const url = `${this.siteUrl}${legacyPath.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }).catch((error: unknown) => {
      console.warn(`    ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response?.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    const body = Buffer.from(await response.arrayBuffer());
    if (contentType.includes('text/html') || body.length === 0) {
      return null;
    }
    return { source: url, body };
  }
}

async function saveEntry(entry: AssetEntry, legacy: LegacySource, force: boolean): Promise<SavedAsset | null> {
  const target = localFilePath(entry.local);
  const processed = entry.preset !== null;
  if (!force && existsSync(target) && (!processed || entry.width !== null)) {
    const info = await stat(target);
    if (info.size > 0) {
      return { source: entry.source ?? entry.legacyPaths[0] ?? '', bytes: info.size, width: entry.width, height: entry.height };
    }
  }
  const file = await legacy.read(entry);
  if (!file) {
    return null;
  }
  await mkdir(path.dirname(target), { recursive: true });
  if (entry.preset === null) {
    await writeFile(target, file.body);
    return { source: file.source, bytes: file.body.length, width: null, height: null };
  }
  try {
    const input = await imageProcessingService.prepareTrustedSource(file.body, {
      svg: isSvg(file.body),
      width: IMAGE_PRESETS[entry.preset].width * (entry.crop ? Math.ceil(1 / entry.crop.width) : 2),
      crop: entry.crop
    });
    const image = await imageProcessingService.process(input, entry.preset, entry.local);
    await writeFile(target, image.main.buffer);
    if (image.thumb) {
      await writeFile(localFilePath(thumbUrl(entry.local)), image.thumb.buffer);
    }
    return { source: file.source, bytes: image.main.buffer.length, width: image.main.width, height: image.main.height };
  } catch (error) {
    console.warn(`    ${file.source}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (item !== undefined) {
        await worker(item);
      }
    }
  });
  await Promise.all(runners);
}

async function updateJson<S extends z.ZodType>(file: string, schema: S, mutate: (data: z.infer<S>) => void): Promise<void> {
  if (!existsSync(file)) {
    return;
  }
  const data = schema.parse(JSON.parse(await readFile(file, 'utf8')));
  mutate(data);
  await writeFile(file, `${JSON.stringify(schema.parse(data), null, 2)}\n`, 'utf8');
}

function stripMissingReferences(html: string, missing: Set<string>, stats: PruneStats): string {
  const isMissing = (value: string): boolean => missing.has(value.replace(/&amp;/g, '&'));
  const withoutImages = html.replace(/<img\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*>/gi, (whole, _quote: string, src: string) => {
    if (!isMissing(src)) {
      return whole;
    }
    stats.references += 1;
    return '';
  });
  return withoutImages.replace(/<a\b[^>]*?\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (whole, _quote: string, href: string, inner: string) => {
    if (!isMissing(href)) {
      return whole;
    }
    stats.references += 1;
    return inner;
  });
}

function clearMissing(value: string, missing: Set<string>, stats: PruneStats): string {
  if (value && missing.has(value)) {
    stats.fields += 1;
    return '';
  }
  return value;
}

async function applyResults(manifest: { assets: AssetEntry[] }): Promise<PruneStats> {
  const missing = new Set(manifest.assets.filter((entry) => entry.status === 'missing').map((entry) => entry.local));
  const sizes = new Map(manifest.assets.filter((entry) => entry.status === 'ok').map((entry) => [entry.local, entry]));
  const stats: PruneStats = { fields: 0, images: 0, references: 0 };
  const strip = (html: string): string => stripMissingReferences(html, missing, stats);
  const clear = (value: string): string => clearMissing(value, missing, stats);

  await updateJson(DATA_FILES.pages, pagesFileSchema, (pages) => {
    for (const page of pages) {
      page.heroImage = clear(page.heroImage);
      page.content = strip(page.content);
    }
  });
  await updateJson(DATA_FILES.pageImages, pageImagesFileSchema, (images) => {
    const kept = images.filter((image) => !missing.has(image.src));
    stats.images += images.length - kept.length;
    images.splice(0, images.length, ...kept);
    for (const image of images) {
      const size = sizes.get(image.src);
      image.width = size?.width ?? image.width;
      image.height = size?.height ?? image.height;
    }
  });
  await updateJson(DATA_FILES.home, homeSchema, (home) => {
    for (const slide of home.hero.slides) {
      slide.image = clear(slide.image);
      slide.video = clear(slide.video);
    }
    home.hero.slides = home.hero.slides.filter((slide) => slide.image !== '' || slide.video !== '');
    home.about.image = clear(home.about.image);
    home.about.content = strip(home.about.content);
    home.quotes.image = clear(home.quotes.image);
  });
  await updateJson(DATA_FILES.settings, settingsSchema, (settings) => {
    settings.logo = clear(settings.logo);
    settings.favicon = clear(settings.favicon);
    settings.seo.defaultImage = clear(settings.seo.defaultImage);
  });
  return stats;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const config = await loadTransformConfig();
  const localRoot = config.legacy.localRoot ? resolveFromSite(config.legacy.localRoot) : null;
  const legacy = new LegacySource(localRoot && existsSync(localRoot) ? localRoot : null, config.legacySiteUrl.replace(/\/+$/, ''));
  const manifest = await readAssetManifest();
  const total = manifest.assets.length;
  console.info(`Collecting ${total} assets (local copy: ${localRoot ?? 'none'}, fallback: ${config.legacySiteUrl})`);

  let done = 0;
  await runPool(manifest.assets, async (entry) => {
    const result = await saveEntry(entry, legacy, force);
    done += 1;
    if (result) {
      entry.status = 'ok';
      entry.source = result.source;
      entry.bytes = result.bytes;
      entry.width = result.width;
      entry.height = result.height;
    } else {
      entry.status = 'missing';
      entry.source = null;
      entry.bytes = null;
      entry.width = null;
      entry.height = null;
      console.warn(`  missing ${entry.local} (${entry.legacyPaths.join(', ')})`);
    }
    if (done % 25 === 0 || done === total) {
      console.info(`  ${done}/${total}`);
    }
  });

  manifest.generatedAt = new Date().toISOString();
  await writeAssetManifest(manifest);
  const stats = await applyResults(manifest);
  const ok = manifest.assets.filter((entry) => entry.status === 'ok');
  const fromLive = ok.filter((entry) => entry.source?.startsWith('http')).length;
  console.info(
    `Done: ${ok.length} saved (${ok.length - fromLive} from the local copy, ${fromLive} from the live site), ${total - ok.length} missing (${stats.fields} fields cleared, ${stats.images} images removed, ${stats.references} content references stripped).`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
