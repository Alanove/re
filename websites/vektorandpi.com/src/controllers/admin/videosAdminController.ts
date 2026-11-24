import type { Request, Response } from 'express';
import { firstFile } from '../../middleware/upload.js';
import { idParamSchema, videoCreateSchema, videoFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { videosService } from '../../services/videosService.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

function postedTitle(body: unknown): string {
  if (body && typeof body === 'object' && 'title' in body && typeof body.title === 'string') {
    return body.title;
  }
  return '';
}

export class VideosAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const videos = await videosService.list();
    render(res, 'videos/list', { pageTitle: 'Videos', videos });
  }

  public static createForm(_req: Request, res: Response): void {
    render(res, 'videos/create', { pageTitle: 'New video', values: { title: '' } });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const input = parseOrThrow(videoCreateSchema, req.body);
      const video = await videosService.create(input.title);
      setFlash(req, 'success', 'Video created. Add the link and a photo, then publish it.');
      res.redirect(`/admin/videos/${video.id}/edit`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      render(res, 'videos/create', { pageTitle: 'New video', values: { title: postedTitle(req.body) }, errors: state.fields, error: state.message });
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const video = await videosService.getById(id);
    render(res, 'videos/edit', { pageTitle: video.title, video, errors: {} });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const video = await videosService.getById(id);
    try {
      const input = parseOrThrow(videoFormSchema, req.body);
      const thumbFile = firstFile(req, 'thumbFile');
      const thumb = thumbFile ? await mediaService.saveImage(thumbFile, 'videos', 'card') : null;
      await videosService.update(id, input, thumb);
      setFlash(req, 'success', 'Video saved.');
      res.redirect(`/admin/videos/${id}/edit`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      render(res, 'videos/edit', { pageTitle: video.title, video, errors: state.fields, error: state.message });
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await videosService.remove(id);
    if (req.get('accept')?.includes('application/json')) {
      res.json({ success: true });
      return;
    }
    setFlash(req, 'success', 'Video deleted.');
    res.redirect('/admin/videos');
  }
}
