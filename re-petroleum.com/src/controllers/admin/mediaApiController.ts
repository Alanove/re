import type { Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../errors/httpError.js';
import { firstFile } from '../../middleware/upload.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { pageImagesQuerySchema, uploadImageBodySchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { videoEmbedService } from '../../services/videoEmbedService.js';

const fileKeyParamSchema = z.object({ key: z.string().regex(/^[a-z0-9_-]{1,80}$/i, 'The page key is not valid.') });
const videoBodySchema = z.object({ url: z.string().trim().min(1, 'Enter a video link').max(500) });

export class MediaApiController {
  public static async uploadImage(req: Request, res: Response): Promise<void> {
    const body = parseOrThrow(uploadImageBodySchema, req.body ?? {});
    const file = firstFile(req, 'image');
    if (!file) {
      throw new BadRequestError('Choose an image to upload.');
    }
    const folder = body.pageKey === 'generic' ? 'editor' : `editor/${body.pageKey.replace(/[^a-z0-9_-]/gi, '')}`;
    const saved = await mediaService.saveImage(file, folder);
    res.json({ success: true, url: saved.url, width: saved.width, height: saved.height });
  }

  public static async pageImages(req: Request, res: Response): Promise<void> {
    const query = parseOrThrow(pageImagesQuerySchema, req.query);
    const pageId = query.pageId ? Number(query.pageId) : undefined;
    const images = query.pageKey === 'generic' && pageId === undefined ? [] : await mediaService.listForPage(query.pageKey, pageId);
    res.json({ success: true, images });
  }

  public static async publicImages(_req: Request, res: Response): Promise<void> {
    const images = await mediaService.listLibrary(300);
    res.json({ success: true, images: images.map((image) => ({ url: image.url, name: image.name, size: image.size })) });
  }

  public static async uploadFile(req: Request, res: Response): Promise<void> {
    const { key } = parseOrThrow(fileKeyParamSchema, req.params);
    const file = firstFile(req, 'file');
    if (!file) {
      throw new BadRequestError('Choose a file to upload.');
    }
    const saved = await mediaService.saveDocument(file, `files/${key}`);
    res.json({ success: true, filePath: saved.url, originalName: saved.originalName });
  }

  public static videoEmbed(req: Request, res: Response): void {
    const body = parseOrThrow(videoBodySchema, req.body ?? {});
    res.json({ success: true, ...videoEmbedService.resolve(body.url) });
  }
}
