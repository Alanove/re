import { createRequire } from 'node:module';
import type sharpModule from 'sharp';
import type { Metadata, Sharp, SharpOptions } from 'sharp';
import { env } from '../config/env.js';
import { BadRequestError, ServiceUnavailableError } from '../errors/httpError.js';

export const IMAGE_PRESETS = {
  hero: { width: 2000, height: 2000 },
  slide: { width: 2000, height: 2000 },
  gallery: { width: 1600, height: 1600 },
  product: { width: 1400, height: 1400 },
  content: { width: 1600, height: 1600 },
  card: { width: 800, height: 800 },
  social: { width: 1200, height: 1200 },
  logo: { width: 600, height: 600 },
  thumb: { width: 400, height: 400 },
  favicon: { width: 512, height: 512 }
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

const WEBP_QUALITY = 82;
const THUMB_QUALITY = 78;
const MAX_INPUT_PIXELS = 60_000_000;

type SharpFactory = typeof sharpModule;

export interface ImageProcessingOptions {
  concurrency: number;
  cacheMb: number;
}

export interface ProcessedVariant {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  extension: '.webp' | '.png';
  main: ProcessedVariant;
  thumb: ProcessedVariant | null;
}

export interface ImageRuntimeReport {
  platform: string;
  arch: string;
  libc: string;
  node: string;
  sharp: string;
  libvips: string;
  backend: 'native' | 'wasm';
  webp: boolean;
  concurrency: number;
}

async function render(pipeline: Sharp): Promise<ProcessedVariant> {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.pageHeight ?? info.height };
}

function libcFamily(): string {
  if (process.platform !== 'linux') {
    return 'n/a';
  }
  const report = process.report.getReport() as { header?: { glibcVersionRuntime?: string } };
  const glibc = report.header?.glibcVersionRuntime;
  return glibc ? `glibc ${glibc}` : 'musl';
}

function nativeBackendPackage(): string {
  const os = process.platform === 'linux' && libcFamily() === 'musl' ? 'linuxmusl' : process.platform;
  return `@img/sharp-${os}-${process.arch}`;
}

function hasNativeBackend(): boolean {
  try {
    createRequire(import.meta.url).resolve(`${nativeBackendPackage()}/package`);
    return true;
  } catch {
    return false;
  }
}

export class ImageProcessingService {
  private factory: Promise<SharpFactory> | null = null;

  public constructor(private readonly options: ImageProcessingOptions) {}

  public async process(buffer: Buffer, preset: ImagePreset, label = 'Image'): Promise<ProcessedImage> {
    const sharp = await this.load();
    const source = (animated: boolean): Sharp => sharp(buffer, { animated, limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' } satisfies SharpOptions);
    let metadata: Metadata;
    try {
      metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch {
      throw new BadRequestError(`${label} could not be read as an image.`);
    }
    if (metadata.format === 'svg') {
      throw new BadRequestError(`${label} is an SVG. Upload a JPEG, PNG, GIF or WebP image instead.`);
    }
    const animated = (metadata.pages ?? 1) > 1;
    const size = IMAGE_PRESETS[preset];
    const resize = { width: size.width, height: size.height, fit: 'inside' as const, withoutEnlargement: true };

    try {
      if (preset === 'favicon') {
        const main = await render(source(false).rotate().resize(resize).png({ compressionLevel: 9 }));
        return { extension: '.png', main, thumb: null };
      }
      const oriented = (input: Sharp): Sharp => (animated ? input : input.rotate());
      const main = await render(oriented(source(animated)).resize(resize).webp({ quality: WEBP_QUALITY, effort: 4 }));
      const thumbSize = IMAGE_PRESETS.thumb;
      const thumb = await render(
        oriented(source(false))
          .resize({ width: thumbSize.width, height: thumbSize.height, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: THUMB_QUALITY, effort: 4 })
      );
      return { extension: '.webp', main, thumb };
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(`${label} could not be converted. Try saving it again as JPEG or PNG.`);
    }
  }

  public async report(): Promise<ImageRuntimeReport> {
    const sharp = await this.load();
    return {
      platform: process.platform,
      arch: process.arch,
      libc: libcFamily(),
      node: process.versions.node,
      sharp: sharp.versions.sharp,
      libvips: sharp.versions.vips,
      backend: hasNativeBackend() ? 'native' : 'wasm',
      webp: sharp.format.webp.output.buffer,
      concurrency: sharp.concurrency()
    };
  }

  private load(): Promise<SharpFactory> {
    this.factory ??= this.importSharp();
    return this.factory;
  }

  private async importSharp(): Promise<SharpFactory> {
    try {
      const sharp = (await import('sharp')).default;
      sharp.concurrency(this.options.concurrency);
      sharp.cache(this.options.cacheMb > 0 ? { memory: this.options.cacheMb, files: 0, items: 50 } : false);
      if (!hasNativeBackend()) {
        console.warn(`[images] ${nativeBackendPackage()} is not installed; sharp is running on the slow WebAssembly fallback. Run "npm ci" on this server.`);
      }
      return sharp;
    } catch (error) {
      this.factory = null;
      const target = `${process.platform}-${process.arch} (${libcFamily()}, Node ${process.versions.node})`;
      console.error(`[images] sharp failed to load on ${target}. Reinstall on this machine with "npm ci" (never copy node_modules between operating systems), then run "npm run media:check".`, error);
      throw new ServiceUnavailableError('Image processing is unavailable on this server. Ask the administrator to run "npm run media:check".', error);
    }
  }
}

export const imageProcessingService = new ImageProcessingService({ concurrency: env.SHARP_CONCURRENCY, cacheMb: env.SHARP_CACHE_MB });
