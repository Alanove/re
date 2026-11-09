import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DATA_FILES } from '../../src/config/paths.js';

export const assetEntrySchema = z.object({
  local: z.string().startsWith('/uploads/'),
  candidates: z.array(z.url()).min(1),
  status: z.enum(['pending', 'ok', 'missing']),
  source: z.url().nullable(),
  bytes: z.number().int().nonnegative().nullable()
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

export const assetManifestSchema = z.object({
  generatedAt: z.iso.datetime(),
  assets: z.array(assetEntrySchema)
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

export class AssetCollector {
  private readonly entries = new Map<string, AssetEntry>();

  public add(local: string, candidates: string[]): string {
    const existing = this.entries.get(local);
    if (existing) {
      for (const candidate of candidates) {
        if (!existing.candidates.includes(candidate)) {
          existing.candidates.push(candidate);
        }
      }
      return local;
    }
    this.entries.set(local, { local, candidates: [...candidates], status: 'pending', source: null, bytes: null });
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
