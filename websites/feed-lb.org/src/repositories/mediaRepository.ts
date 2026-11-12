import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '../config/paths.js';
import { isThumbFile, thumbUrl } from '../domain/media.js';

export interface StoredMedia {
  url: string;
  name: string;
  size: number;
  modifiedAt: string;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function toPublicUrl(absolutePath: string): string {
  return `/${path.relative(PATHS.public, absolutePath).split(path.sep).join('/')}`;
}

function resolveUploadUrl(url: string): string | null {
  if (!url.startsWith('/uploads/')) {
    return null;
  }
  const absolute = path.resolve(PATHS.public, `.${decodeURIComponent(url)}`);
  const uploadsRoot = path.resolve(PATHS.uploads);
  return absolute.startsWith(uploadsRoot + path.sep) ? absolute : null;
}

function safeBaseName(originalName: string): string {
  return (
    path
      .basename(originalName, path.extname(originalName))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'
  );
}

async function datedFolder(folder: string, now: Date): Promise<string> {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '');
  const dir = path.join(PATHS.uploads, safeFolder, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  await mkdir(dir, { recursive: true });
  return dir;
}

export interface MediaVariant {
  suffix: string;
  buffer: Buffer;
}

export class MediaRepository {
  public async save(buffer: Buffer, originalName: string, folder: string): Promise<StoredMedia> {
    const [stored] = await this.saveVariants([{ suffix: '', buffer }], originalName, path.extname(originalName).toLowerCase(), folder);
    if (!stored) {
      throw new Error('Nothing was stored');
    }
    return stored;
  }

  public async saveVariants(variants: MediaVariant[], originalName: string, extension: string, folder: string): Promise<StoredMedia[]> {
    const now = new Date();
    const dir = await datedFolder(folder, now);
    const stem = `${safeBaseName(originalName)}-${randomBytes(4).toString('hex')}`;
    const written: StoredMedia[] = [];
    try {
      for (const variant of variants) {
        const fileName = `${stem}${variant.suffix}${extension}`;
        const absolute = path.join(dir, fileName);
        await writeFile(absolute, variant.buffer, { flag: 'wx' });
        written.push({ url: toPublicUrl(absolute), name: fileName, size: variant.buffer.length, modifiedAt: now.toISOString() });
      }
    } catch (error) {
      for (const file of written) {
        await this.unlinkUrl(file.url);
      }
      throw error;
    }
    return written;
  }

  public async remove(url: string): Promise<boolean> {
    const removed = await this.unlinkUrl(url);
    const thumb = thumbUrl(url);
    if (thumb !== url) {
      await this.unlinkUrl(thumb);
    }
    return removed;
  }

  private async unlinkUrl(url: string): Promise<boolean> {
    const absolute = resolveUploadUrl(url);
    if (!absolute) {
      return false;
    }
    try {
      await unlink(absolute);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  public async exists(url: string): Promise<boolean> {
    const absolute = resolveUploadUrl(url);
    if (!absolute) {
      return false;
    }
    try {
      const info = await stat(absolute);
      return info.isFile();
    } catch {
      return false;
    }
  }

  public async listImages(folder: string, limit: number): Promise<StoredMedia[]> {
    const root = path.join(PATHS.uploads, folder.replace(/[^a-z0-9/_-]/gi, ''));
    const results: StoredMedia[] = [];
    await this.walk(root, results);
    return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, limit);
  }

  private async walk(dir: string, results: StoredMedia[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(absolute, results);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !isThumbFile(entry.name)) {
        const info = await stat(absolute);
        results.push({ url: toPublicUrl(absolute), name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() });
      }
    }
  }
}

export const mediaRepository = new MediaRepository();
