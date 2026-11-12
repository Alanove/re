import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DATA_FILES } from '../../src/config/paths.js';
import { IMAGE_PRESETS, type ImagePreset } from '../../src/services/imageProcessingService.js';

const presetNames = Object.keys(IMAGE_PRESETS) as [ImagePreset, ...ImagePreset[]];

const fraction = z.number().min(0).max(1);

/** Region of the source to keep, as fractions of its width and height. */
export const assetCropSchema = z
  .object({ left: fraction, top: fraction, width: fraction.positive(), height: fraction.positive() })
  .refine((crop) => crop.left + crop.width <= 1 && crop.top + crop.height <= 1, 'Crop must stay inside the image');
export type AssetCrop = z.infer<typeof assetCropSchema>;

export const assetEntrySchema = z.object({
  local: z.string().startsWith('/uploads/'),
  legacyPaths: z.array(z.string().startsWith('/')).min(1),
  preset: z.enum(presetNames).nullable(),
  status: z.enum(['pending', 'ok', 'missing']),
  source: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  crop: assetCropSchema.nullable().default(null)
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

export const assetManifestSchema = z.object({
  generatedAt: z.iso.datetime(),
  assets: z.array(assetEntrySchema)
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

export class AssetCollector {
  private readonly entries = new Map<string, AssetEntry>();

  public add(local: string, legacyPaths: string[], preset: ImagePreset | null, crop: AssetCrop | null = null): string {
    const existing = this.entries.get(local);
    if (existing) {
      for (const legacyPath of legacyPaths) {
        if (!existing.legacyPaths.includes(legacyPath)) {
          existing.legacyPaths.push(legacyPath);
        }
      }
      return local;
    }
    this.entries.set(local, { local, legacyPaths: [...legacyPaths], preset, status: 'pending', source: null, bytes: null, width: null, height: null, crop });
    return local;
  }

  public toManifest(): AssetManifest {
    return assetManifestSchema.parse({
      generatedAt: new Date().toISOString(),
      assets: [...this.entries.values()].sort((a, b) => a.local.localeCompare(b.local))
    });
  }
}

export async function readAssetManifest(): Promise<AssetManifest> {
  if (!existsSync(DATA_FILES.assetManifest)) {
    throw new Error(`Asset manifest not found at ${DATA_FILES.assetManifest}. Run "npm run import:legacy" first.`);
  }
  const raw = await readFile(DATA_FILES.assetManifest, 'utf8');
  return assetManifestSchema.parse(JSON.parse(raw));
}

export async function writeAssetManifest(manifest: AssetManifest): Promise<void> {
  const validated = assetManifestSchema.parse(manifest);
  await writeFile(DATA_FILES.assetManifest, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
}
