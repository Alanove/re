import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PATHS } from './paths.js';

const transformConfigSchema = z.object({
  siteKey: z.string().regex(/^[a-z0-9-]+$/),
  siteName: z.string().min(1),
  legacySiteUrl: z.url(),
  cmsSource: z.string().min(1),
  /** Legacy export; on this site it only holds the hashtag sheets (the page rows come from the crawl). */
  contentWorkbook: z.string().min(1).nullable(),
  contentSeed: z.string().min(1),
  designDir: z.string().min(1),
  outputDir: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  logo: z.object({
    url: z.url(),
    localPath: z.string().startsWith('/uploads/'),
    note: z.string()
  }),
  legacy: z.object({
    localRoot: z.string().min(1).nullable().default(null),
    pageImagePattern: z.string().includes('{pageId}').includes('{fileName}'),
    contactPageKey: z.string().min(1),
    uploadsMirrorPrefix: z.string().startsWith('/uploads/'),
    /** Book Collector XML export behind the Spiritual Library, relative to `localRoot`. */
    booksFile: z.string().min(1).nullable().default(null),
    /** Host names whose absolute links are rewritten to local paths. */
    legacyHosts: z.array(z.string().min(1)).default([])
  }),
  crawl: z.object({
    seeds: z.array(z.string().startsWith('/')).min(1),
    concurrency: z.number().int().min(1).max(4),
    delayMs: z.number().int().min(200).max(10_000),
    userAgent: z.string().min(1),
    cacheDir: z.string().min(1),
    outputDir: z.string().min(1)
  }),
  cmsSync: z.object({
    adminPublicFiles: z.array(z.string().min(1)),
    adminPublicDirs: z.array(z.string().min(1))
  })
});

export type TransformConfig = z.infer<typeof transformConfigSchema>;

let cached: TransformConfig | null = null;

export async function loadTransformConfig(): Promise<TransformConfig> {
  if (cached) {
    return cached;
  }
  const raw = await readFile(PATHS.transformConfig, 'utf8');
  cached = transformConfigSchema.parse(JSON.parse(raw));
  return cached;
}

export function resolveFromSite(relativeOrAbsolute: string): string {
  return path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(PATHS.root, relativeOrAbsolute);
}
