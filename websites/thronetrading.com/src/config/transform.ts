import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PATHS } from './paths.js';

const transformConfigSchema = z.object({
  siteKey: z.string().regex(/^[a-z0-9-]+$/),
  siteName: z.string().min(1),
  legacySiteUrl: z.url(),
  cmsSource: z.string().min(1),
  contentWorkbook: z.string().min(1),
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
    footerPageKey: z.string().min(1).nullable(),
    contactPageKey: z.string().min(1),
    hiddenPageKeys: z.array(z.string().min(1)).default([]),
    uploadsMirrorPrefix: z.string().startsWith('/uploads/')
  }),
  catalog: z
    .object({
      productsRootKey: z.string().min(1),
      brandPageTypes: z.record(z.string().regex(/^\d+$/), z.string().min(1)),
      brandLogoPattern: z.string().includes('{slug}'),
      sliderConfig: z.string().min(1).nullable(),
      slideImagePattern: z.string().includes('{image}')
    })
    .nullable()
    .default(null),
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
