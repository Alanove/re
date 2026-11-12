import path from 'node:path';
import { BadRequestError } from '../errors/httpError.js';
import { mediaRepository, type StoredMedia } from '../repositories/mediaRepository.js';
import { pageImagesRepository } from '../repositories/pageImagesRepository.js';
import { pagesRepository } from '../repositories/pagesRepository.js';
import { THUMB_SUFFIX } from '../domain/media.js';
import { imageProcessingService, type ImagePreset } from './imageProcessingService.js';
import type { UploadedImage, UploadedVideo } from './pagesService.js';

export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

/** MP3 files start with an ID3 tag or directly with an MPEG audio frame sync. */
function isMp3(buffer: Buffer): boolean {
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    return true;
  }
  return buffer.length >= 2 && buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0;
}

type VideoKind = 'mp4' | 'webm';

function detectVideoKind(buffer: Buffer): VideoKind | null {
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'mp4';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return 'webm';
  }
  return null;
}

const isPdf = (buffer: Buffer): boolean => buffer.subarray(0, 5).toString('ascii') === '%PDF-';
const isZip = (buffer: Buffer): boolean => buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
const isOle = (buffer: Buffer): boolean => buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

const DOCUMENT_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  '.pdf': isPdf,
  '.docx': isZip,
  '.xlsx': isZip,
  '.pptx': isZip,
  '.doc': isOle,
  '.xls': isOle,
  '.ppt': isOle
};

function detectKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return 'gif';
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}

function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    const length = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

export function readImageSize(buffer: Buffer): { width: number | null; height: number | null } {
  const kind = detectKind(buffer);
  if (kind === 'png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (kind === 'gif' && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (kind === 'jpeg') {
    const size = jpegSize(buffer);
    return size ?? { width: null, height: null };
  }
  if (kind === 'webp' && buffer.length >= 30) {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (chunk === 'VP8 ') {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return { width: null, height: null };
}

export class MediaService {
  public async saveImage(file: IncomingFile, folder: string, preset: ImagePreset): Promise<UploadedImage> {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestError(`${file.originalname} is larger than 8 MB.`);
    }
    if (!detectKind(file.buffer)) {
      throw new BadRequestError(`${file.originalname} is not a JPEG, PNG, GIF or WebP image.`);
    }
    const processed = await imageProcessingService.process(file.buffer, preset, file.originalname);
    const variants = [{ suffix: '', buffer: processed.main.buffer }];
    if (processed.thumb) {
      variants.push({ suffix: THUMB_SUFFIX, buffer: processed.thumb.buffer });
    }
    const [stored] = await mediaRepository.saveVariants(variants, file.originalname, processed.extension, folder);
    if (!stored) {
      throw new BadRequestError(`${file.originalname} could not be saved.`);
    }
    return { url: stored.url, width: processed.main.width, height: processed.main.height };
  }

  public async saveVideo(file: IncomingFile, folder: string): Promise<UploadedVideo> {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new BadRequestError(`${file.originalname} is larger than 25 MB.`);
    }
    const kind = detectVideoKind(file.buffer);
    if (!kind) {
      throw new BadRequestError(`${file.originalname} is not an MP4 or WebM video.`);
    }
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const stored = await mediaRepository.save(file.buffer, `${baseName}.${kind}`, folder);
    return { url: stored.url };
  }

  public async saveAudio(file: IncomingFile, folder: string): Promise<{ url: string }> {
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestError(`${file.originalname} is larger than 30 MB.`);
    }
    if (!isMp3(file.buffer)) {
      throw new BadRequestError(`${file.originalname} is not an MP3 file.`);
    }
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const stored = await mediaRepository.save(file.buffer, `${baseName}.mp3`, folder);
    return { url: stored.url };
  }

  public async discard(files: { url: string }[]): Promise<void> {
    for (const file of files) {
      await mediaRepository.remove(file.url);
    }
  }

  public async saveDocument(file: IncomingFile, folder: string): Promise<{ url: string; originalName: string }> {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new BadRequestError(`${file.originalname} is larger than 20 MB.`);
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const expected = DOCUMENT_SIGNATURES[ext];
    if (!expected || !expected(file.buffer)) {
      throw new BadRequestError(`${file.originalname} is not a supported PDF, Word, Excel or PowerPoint file.`);
    }
    const stored = await mediaRepository.save(file.buffer, file.originalname, folder);
    return { url: stored.url, originalName: file.originalname };
  }

  public async listLibrary(limit = 300): Promise<StoredMedia[]> {
    return mediaRepository.listImages('', limit);
  }

  public async listForPage(pageKey: string, pageId?: number): Promise<{ url: string; name: string; size: number }[]> {
    const page = await this.findEditorPage(pageKey, pageId);
    const images: { url: string; name: string; size: number }[] = [];
    const seen = new Set<string>();
    const add = (url: string, name?: string, size = 0) => {
      const clean = url.trim();
      if (!clean || seen.has(clean)) {
        return;
      }
      seen.add(clean);
      const fallback = decodeURIComponent(clean.split('/').pop() ?? clean);
      images.push({ url: clean, name: name && name.length > 0 ? name : fallback, size });
    };

    const folders = new Set<string>();
    const remember = (value: string) => {
      const safe = value.replace(/[^a-z0-9_-]/gi, '');
      if (safe && safe !== 'generic' && safe !== 'new-page') {
        folders.add(`editor/${safe}`);
      }
    };
    if (page) {
      remember(page.key);
      remember(String(page.id));
    }
    remember(pageKey);
    if (pageId) {
      remember(String(pageId));
    }

    for (const folder of folders) {
      for (const file of await mediaRepository.listImages(folder, 200)) {
        add(file.url, file.name, file.size);
      }
    }

    if (page) {
      if (page.heroImage) {
        add(page.heroImage);
      }
      for (const image of await pageImagesRepository.findByPage(page.id)) {
        add(image.src);
      }
      for (const match of page.content.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
        if (match[1]) {
          add(match[1]);
        }
      }
    }

    return images;
  }

  private async findEditorPage(pageKey: string, pageId?: number) {
    if (pageKey && pageKey !== 'generic') {
      const byKey = await pagesRepository.findByKey(pageKey);
      if (byKey) {
        return byKey;
      }
      if (/^\d+$/.test(pageKey)) {
        const byNumericKey = await pagesRepository.findById(Number(pageKey));
        if (byNumericKey) {
          return byNumericKey;
        }
      }
    }
    if (pageId && Number.isInteger(pageId) && pageId > 0) {
      return pagesRepository.findById(pageId);
    }
    return null;
  }
}

export const mediaService = new MediaService();
