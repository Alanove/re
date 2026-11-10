import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PATHS } from './paths.js';

const fraction = z.number().min(0).max(1);
const pageKey = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

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
    note: z.string(),
    crop: z
      .object({ left: fraction, top: fraction, width: fraction.positive(), height: fraction.positive() })
      .refine((crop) => crop.left + crop.width <= 1 && crop.top + crop.height <= 1, 'Crop must stay inside the image')
      .nullable()
      .default(null)
  }),
  legacy: z.object({
    localRoot: z.string().min(1).nullable().default(null),
    pageImagePattern: z.string().includes('{pageId}').includes('{fileName}'),
    galleryImagePattern: z.string().includes('{pageId}').includes('{fileName}'),
    bannerPattern: z.string().includes('{url}').nullable().default(null),
    footerPageKey: z.string().min(1).nullable(),
    contactPageKey: z.string().min(1).nullable(),
    hiddenPageKeys: z.array(z.string().min(1)).default([]),
    uploadsMirrorPrefix: z.string().startsWith('/uploads/')
  }),
  collections: z.object({
    newsRootKey: pageKey,
    eventsRootKey: pageKey
  }),
  videos: z.object({
    rootKey: pageKey,
    channelHandleUrl: z.url()
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
