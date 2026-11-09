import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DATA_FILES } from '../../src/config/paths.js';
import { IMAGE_PRESETS, type ImagePreset } from '../../src/services/imageProcessingService.js';

const presetNames = Object.keys(IMAGE_PRESETS) as [ImagePreset, ...ImagePreset[]];

export const assetEntrySchema = z.object({
  local: z.string().startsWith('/uploads/'),
  legacyPaths: z.array(z.string().startsWith('/')).min(1),
  preset: z.enum(presetNames).nullable(),
  status: z.enum(['pending', 'ok', 'missing']),
  source: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null)
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

export const assetManifestSchema = z.object({
  generatedAt: z.iso.datetime(),
  assets: z.array(assetEntrySchema)
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

export class AssetCollector {
  private readonly entries = new Map<string, AssetEntry>();

  public add(local: string, legacyPaths: string[], preset: ImagePreset | null): string {
    const existing = this.entries.get(local);
    if (existing) {
      for (const legacyPath of legacyPaths) {
        if (!existing.legacyPaths.includes(legacyPath)) {
          existing.legacyPaths.push(legacyPath);
        }
      }
      return local;
    }
    this.entries.set(local, { local, legacyPaths: [...legacyPaths], preset, status: 'pending', source: null, bytes: null, width: null, height: null });
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
