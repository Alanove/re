import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES, PATHS } from '../src/config/paths.js';
import { pageImagesFileSchema, pagesFileSchema } from '../src/domain/models.js';
import { readImageSize } from '../src/services/mediaService.js';
import { readAssetManifest, writeAssetManifest, type AssetEntry } from './lib/asset-manifest.js';

const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 45_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; site-migration/1.0)';

interface DownloadResult {
  source: string;
  bytes: number;
}

function localFilePath(local: string): string {
  const relative = decodeURIComponent(local.replace(/^\/+/, ''));
  const target = path.resolve(PATHS.public, relative);
  if (!target.startsWith(`${PATHS.uploads}${path.sep}`)) {
    throw new Error(`Refusing to write outside public/uploads: ${local}`);
  }
  return target;
}

async function fetchFirstAvailable(entry: AssetEntry): Promise<{ source: string; body: Buffer } | null> {
  for (const candidate of entry.candidates) {
    const response = await fetch(candidate, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }).catch((error: unknown) => {
      console.warn(`    ${candidate}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response?.ok) {
      continue;
    }
    const contentType = response.headers.get('content-type') ?? '';
    const body = Buffer.from(await response.arrayBuffer());
    if (contentType.includes('text/html') || body.length === 0) {
      continue;
    }
    return { source: candidate, body };
  }
  return null;
}

async function downloadEntry(entry: AssetEntry, force: boolean): Promise<DownloadResult | null> {
  const target = localFilePath(entry.local);
  if (!force && existsSync(target)) {
    const info = await stat(target);
    if (info.size > 0) {
      return { source: entry.source ?? entry.candidates[0] ?? '', bytes: info.size };
    }
  }
  const result = await fetchFirstAvailable(entry);
  if (!result) {
    return null;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, result.body);
  return { source: result.source, bytes: result.body.length };
}

async function runPool<T>(items: T[], worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) {
        await worker(item, index);
      }
    }
  });
  await Promise.all(runners);
}

async function fillGalleryDimensions(okLocals: Set<string>): Promise<number> {
  if (!existsSync(DATA_FILES.pageImages)) {
    return 0;
  }
  const images = pageImagesFileSchema.parse(JSON.parse(await readFile(DATA_FILES.pageImages, 'utf8')));
  let updated = 0;
  for (const image of images) {
    if ((image.width !== null && image.height !== null) || !okLocals.has(image.src)) {
      continue;
    }
    const size = readImageSize(await readFile(localFilePath(image.src)));
    if (size.width !== null && size.height !== null) {
      image.width = size.width;
      image.height = size.height;
      updated += 1;
    }
  }
  await writeFile(DATA_FILES.pageImages, `${JSON.stringify(pageImagesFileSchema.parse(images), null, 2)}\n`, 'utf8');
  return updated;
}

function stripMissingReferences(html: string, missingLocals: Set<string>): { html: string; removed: number } {
  let removed = 0;
  const isMissing = (value: string): boolean => missingLocals.has(value.replace(/&amp;/g, '&'));
  const withoutImages = html.replace(/<img\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*>/gi, (whole, _quote: string, src: string) => {
    if (!isMissing(src)) {
      return whole;
    }
    removed += 1;
    return '';
  });
  const withoutLinks = withoutImages.replace(/<a\b[^>]*?\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (whole, _quote: string, href: string, inner: string) => {
    if (!isMissing(href)) {
      return whole;
    }
    removed += 1;
    return inner;
  });
  return { html: withoutLinks, removed };
}

async function pruneMissing(missingLocals: Set<string>): Promise<{ heroes: number; gallery: number; references: number }> {
  let heroes = 0;
  let gallery = 0;
  let references = 0;
  if (missingLocals.size === 0) {
    return { heroes, gallery, references };
  }
  if (existsSync(DATA_FILES.pages)) {
    const pages = pagesFileSchema.parse(JSON.parse(await readFile(DATA_FILES.pages, 'utf8')));
    for (const page of pages) {
      if (page.heroImage && missingLocals.has(page.heroImage)) {
        page.heroImage = '';
        heroes += 1;
      }
      const stripped = stripMissingReferences(page.content, missingLocals);
      page.content = stripped.html;
      references += stripped.removed;
    }
    await writeFile(DATA_FILES.pages, `${JSON.stringify(pagesFileSchema.parse(pages), null, 2)}\n`, 'utf8');
  }
  if (existsSync(DATA_FILES.pageImages)) {
    const images = pageImagesFileSchema.parse(JSON.parse(await readFile(DATA_FILES.pageImages, 'utf8')));
    const kept = images.filter((image) => !missingLocals.has(image.src));
    gallery = images.length - kept.length;
    await writeFile(DATA_FILES.pageImages, `${JSON.stringify(pageImagesFileSchema.parse(kept), null, 2)}\n`, 'utf8');
  }
  return { heroes, gallery, references };
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const manifest = await readAssetManifest();
  const total = manifest.assets.length;
  console.info(`Downloading ${total} assets (concurrency ${CONCURRENCY})`);

  let done = 0;
  await runPool(manifest.assets, async (entry) => {
    const result = await downloadEntry(entry, force);
    done += 1;
    if (result) {
      entry.status = 'ok';
      entry.source = result.source;
      entry.bytes = result.bytes;
    } else {
      entry.status = 'missing';
      entry.source = null;
      entry.bytes = null;
      console.warn(`  missing ${entry.local}`);
    }
    if (done % 50 === 0 || done === total) {
      console.info(`  ${done}/${total}`);
    }
  });

  manifest.generatedAt = new Date().toISOString();
  await writeAssetManifest(manifest);

  const okLocals = new Set(manifest.assets.filter((entry) => entry.status === 'ok').map((entry) => entry.local));
  const missingLocals = new Set(manifest.assets.filter((entry) => entry.status === 'missing').map((entry) => entry.local));
  const pruned = await pruneMissing(missingLocals);
  const dimensions = await fillGalleryDimensions(okLocals);
  console.info(
    `Done: ${okLocals.size} saved, ${missingLocals.size} missing (${pruned.heroes} hero images cleared, ${pruned.gallery} gallery entries removed, ${pruned.references} content references stripped), ${dimensions} gallery images measured.`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
