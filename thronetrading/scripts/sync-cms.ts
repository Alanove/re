import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '../src/config/paths.js';
import { loadTransformConfig, resolveFromSite } from '../src/config/transform.js';

async function ensureExists(target: string, kind: 'file' | 'dir'): Promise<void> {
  const info = await stat(target).catch(() => null);
  if (!info || (kind === 'file' ? !info.isFile() : !info.isDirectory())) {
    throw new Error(`Missing ${kind} in cmsSource: ${target}`);
  }
}

async function main(): Promise<void> {
  const config = await loadTransformConfig();
  const sourceRoot = path.join(resolveFromSite(config.cmsSource), 'admin', 'public');
  await ensureExists(sourceRoot, 'dir');
  console.info(`Syncing admin assets from ${sourceRoot}`);

  for (const relative of config.cmsSync.adminPublicFiles) {
    const from = path.join(sourceRoot, relative);
    const to = path.join(PATHS.adminPublic, relative);
    await ensureExists(from, 'file');
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { force: true });
    console.info(`  file ${relative}`);
  }

  for (const relative of config.cmsSync.adminPublicDirs) {
    const from = path.join(sourceRoot, relative);
    const to = path.join(PATHS.adminPublic, relative);
    await ensureExists(from, 'dir');
    await cp(from, to, { recursive: true, force: true });
    console.info(`  dir  ${relative}`);
  }

  console.info('CMS asset sync complete.');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
