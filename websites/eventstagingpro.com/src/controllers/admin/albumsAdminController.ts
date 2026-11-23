import type { Request, Response } from 'express';
import { filesFor, firstFile } from '../../middleware/upload.js';
import { albumCreateSchema, albumFormSchema, idParamSchema } from '../../schemas/adminSchemas.js';
import { albumsService, type AlbumUploads } from '../../services/albumsService.js';
import { mediaService } from '../../services/mediaService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { parseOrThrow } from '../../middleware/validate.js';

function postedTitle(body: unknown): string {
  if (body && typeof body === 'object' && 'title' in body && typeof body.title === 'string') {
    return body.title;
  }
  return '';
}

export class AlbumsAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const albums = await albumsService.list();
    render(res, 'albums/list', { pageTitle: 'Photo Albums', albums });
  }

  public static createForm(_req: Request, res: Response): void {
    render(res, 'albums/create', { pageTitle: 'New photo album', values: { title: '' } });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const input = parseOrThrow(albumCreateSchema, req.body);
      const album = await albumsService.create(input.title);
      setFlash(req, 'success', 'Photo album created. Add a cover and photos, then publish it.');
      res.redirect(`/admin/albums/${album.id}/edit`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      render(res, 'albums/create', { pageTitle: 'New photo album', values: { title: postedTitle(req.body) }, errors: state.fields, error: state.message });
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const album = await albumsService.getById(id);
    render(res, 'albums/edit', { pageTitle: album.title, album, errors: {} });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const album = await albumsService.getById(id);
    try {
      const input = parseOrThrow(albumFormSchema, req.body);
      const uploads: AlbumUploads = { cover: null, images: [] };
      const coverFile = firstFile(req, 'coverFile');
      if (coverFile) {
        uploads.cover = await mediaService.saveImage(coverFile, 'albums', 'card');
      }
      for (const file of filesFor(req, 'imageFiles')) {
        uploads.images.push(await mediaService.saveImage(file, 'albums', 'gallery'));
      }
      await albumsService.update(id, input, uploads);
      setFlash(req, 'success', 'Photo album saved.');
      res.redirect(`/admin/albums/${id}/edit`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      render(res, 'albums/edit', { pageTitle: album.title, album, errors: state.fields, error: state.message });
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await albumsService.remove(id);
    if (req.get('accept')?.includes('application/json')) {
      res.json({ success: true });
      return;
    }
    setFlash(req, 'success', 'Photo album deleted.');
    res.redirect('/admin/albums');
  }
}
