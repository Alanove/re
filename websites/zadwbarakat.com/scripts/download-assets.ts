/**
 * Fills public/uploads from the asset manifest written by the importer, reading only the local legacy copy (wwwroot)
 * and the extracted inline images. Raster images become WebP (plus a thumbnail), favicons PNG; audio and documents are copied unchanged.
 * Afterwards image sizes are written back to the data files and references to missing files are removed.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { ARTICLES_DIR, DATA_FILES, PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';
import { thumbUrl } from '../src/domain/media.js';
import {
  albumsFileSchema,
  articleSchema,
  hymnsFileSchema,
  pagesFileSchema,
  sectionsFileSchema,
  settingsSchema,
  videosFileSchema,
  type ImageRef
} from '../src/domain/models.js';
import { IMAGE_PRESETS, imageProcessingService } from '../src/services/imageProcessingService.js';
import { INLINE_FOLDER, INLINE_PREFIX, readAssetManifest, writeAssetManifest, type AssetEntry } from './lib/asset-manifest.js';
import { removeEmptyWrappers } from './lib/legacy-html.js';

const CONCURRENCY = 4;

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
  const target = path.resolve(PATHS.public, ...relative.split('/'));
  if (!target.startsWith(`${PATHS.uploads}${path.sep}`)) {
    throw new Error(`Refusing to write outside public/uploads: ${local}`);
  }
  return target;
}

function sameName(a: string, b: string): boolean {
  return a === b || a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();
}

class LegacySource {
  private readonly listings = new Map<string, Promise<string[]>>();

  public constructor(
    private readonly localRoot: string,
    private readonly inlineDir: string
  ) {}

  public async read(entry: AssetEntry): Promise<SourceFile | null> {
    for (const legacyPath of entry.legacyPaths) {
      const local = legacyPath.startsWith(INLINE_PREFIX) ? await this.readInline(legacyPath) : await this.readLocal(legacyPath);
      if (local) {
        return local;
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

  private async readInline(legacyPath: string): Promise<SourceFile | null> {
    const file = path.join(this.inlineDir, path.basename(legacyPath));
    return existsSync(file) ? { source: `inline:${path.basename(legacyPath)}`, body: await readFile(file) } : null;
  }

  private async readLocal(legacyPath: string): Promise<SourceFile | null> {
    let current = this.localRoot;
    for (const segment of legacyPath.split('/').filter(Boolean)) {
      const names = await this.list(current);
      const match = names.find((name) => name === segment) ?? names.find((name) => sameName(name, segment));
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

class ResultApplier {
  public readonly stats: PruneStats = { fields: 0, images: 0, references: 0 };
  private readonly missing: Set<string>;
  private readonly sizes: Map<string, AssetEntry>;

  public constructor(assets: AssetEntry[]) {
    this.missing = new Set(assets.filter((entry) => entry.status === 'missing').map((entry) => entry.local));
    this.sizes = new Map(assets.filter((entry) => entry.status === 'ok').map((entry) => [entry.local, entry]));
  }

  public html(value: string): string {
    const isMissing = (url: string): boolean => this.missing.has(url.replace(/&amp;/g, '&'));
    const withoutImages = value.replace(/<img\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*>/gi, (whole, _quote: string, src: string) => {
      if (!isMissing(src)) {
        return this.sizedImage(whole, src);
      }
      this.stats.references += 1;
      return '';
    });
    const withoutLinks = withoutImages.replace(/<a\b[^>]*?\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (whole, _quote: string, href: string, inner: string) => {
      if (!isMissing(href)) {
        return whole;
      }
      this.stats.references += 1;
      return inner;
    });
    return withoutLinks === value ? value : removeEmptyWrappers(withoutLinks);
  }

  public field(value: string): string {
    if (value && this.missing.has(value)) {
      this.stats.fields += 1;
      return '';
    }
    return value;
  }

  public ref<T extends ImageRef>(value: T | null): T | null {
    if (!value) {
      return value;
    }
    if (this.missing.has(value.src)) {
      this.stats.fields += 1;
      return null;
    }
    const size = this.sizes.get(value.src);
    return { ...value, width: size?.width ?? value.width, height: size?.height ?? value.height };
  }

  public refs<T extends ImageRef>(values: T[]): T[] {
    const kept = values.flatMap((value) => this.ref(value) ?? []);
    this.stats.images += values.length - kept.length;
    return kept;
  }

  /** Adds width and height to a content image when they are known and the tag has none. */
  private sizedImage(tag: string, src: string): string {
    const size = this.sizes.get(src.replace(/&amp;/g, '&'));
    if (!size?.width || !size.height || /\swidth\s*=/i.test(tag)) {
      return tag;
    }
    return tag.replace(/^<img\b/i, `<img width="${size.width}" height="${size.height}"`);
  }
}

async function applyResults(assets: AssetEntry[]): Promise<PruneStats> {
  const apply = new ResultApplier(assets);
  if (existsSync(ARTICLES_DIR)) {
    for (const name of (await readdir(ARTICLES_DIR)).filter((entry) => /^\d+\.json$/.test(entry))) {
      await updateJson(path.join(ARTICLES_DIR, name), articleSchema, (article) => {
        article.image = apply.ref(article.image);
        article.content = apply.html(article.content);
      });
    }
  }
  await updateJson(DATA_FILES.pages, pagesFileSchema, (pages) => {
    for (const page of pages) {
      page.heroImage = apply.field(page.heroImage);
      page.content = apply.html(page.content);
    }
  });
  await updateJson(DATA_FILES.sections, sectionsFileSchema, (sections) => {
    for (const section of sections) {
      section.image = apply.field(section.image);
    }
  });
  await updateJson(DATA_FILES.albums, albumsFileSchema, (albums) => {
    for (const album of albums) {
      album.images = apply.refs(album.images);
    }
  });
  await updateJson(DATA_FILES.videos, videosFileSchema, (videos) => {
    for (const video of videos) {
      video.image = apply.ref(video.image);
    }
  });
  await updateJson(DATA_FILES.hymns, hymnsFileSchema, (hymns) => {
    for (const hymn of hymns) {
      hymn.file = apply.field(hymn.file);
      hymn.active = hymn.active && hymn.file !== '';
    }
  });
  await updateJson(DATA_FILES.settings, settingsSchema, (settings) => {
    settings.logo = apply.field(settings.logo);
    settings.emblem = apply.field(settings.emblem);
    settings.favicon = apply.field(settings.favicon);
    settings.seo.defaultImage = apply.field(settings.seo.defaultImage);
  });
  return apply.stats;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const config = await loadTransformConfig();
  const localRoot = config.legacy.localRoot ? resolveFromSite(config.legacy.localRoot) : null;
  const inlineDir = path.join(resolveFromSite(config.crawl.outputDir), INLINE_FOLDER);
  if (!localRoot || !existsSync(localRoot)) {
    throw new Error(`Legacy files not found: set legacy.localRoot in transform.config.json to the wwwroot folder (now ${localRoot ?? 'unset'}).`);
  }
  const legacy = new LegacySource(localRoot, inlineDir);
  const manifest = await readAssetManifest();
  const total = manifest.assets.length;
  console.info(`Collecting ${total} assets from ${localRoot}`);

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
      console.warn(`  missing ${entry.local} (${entry.legacyPaths[0] ?? ''})`);
    }
    if (done % 100 === 0 || done === total) {
      console.info(`  ${done}/${total}`);
    }
  });

  manifest.generatedAt = new Date().toISOString();
  await writeAssetManifest(manifest);
  const stats = await applyResults(manifest.assets);
  const ok = manifest.assets.filter((entry) => entry.status === 'ok');
  console.info(
    `Done: ${ok.length} saved, ${total - ok.length} missing from the local copy ` +
      `(${stats.fields} fields cleared, ${stats.images} gallery images removed, ${stats.references} content references stripped).`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
