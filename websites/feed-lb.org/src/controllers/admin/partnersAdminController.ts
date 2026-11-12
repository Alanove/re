import type { Request, Response } from 'express';
import { firstFile } from '../../middleware/upload.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, partnerFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import type { UploadedImage } from '../../services/pagesService.js';
import { partnersService } from '../../services/partnersService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

function blankPartner(): Record<string, unknown> {
  return { id: null, name: '', website: '', logo: '', active: true, sort: 100 };
}

function partnerFromBody(body: Record<string, unknown>, id: number | null): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return { id, name: text('name'), website: text('website'), logo: text('logo'), active: Boolean(body.active), sort: text('sort') };
}

export class PartnersAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'partners/list', { pageTitle: 'Partners', partners: await partnersService.list() });
  }

  public static createForm(_req: Request, res: Response): void {
    render(res, 'partners/edit', { pageTitle: 'Add Partner', isCreate: true, partner: blankPartner(), errors: {} });
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const partner = await partnersService.get(id);
    render(res, 'partners/edit', { pageTitle: `Partner: ${partner.name}`, isCreate: false, partner, errors: {} });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    await PartnersAdminController.save(req, res, null);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await partnersService.get(id);
    await PartnersAdminController.save(req, res, id);
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await partnersService.delete(id);
    res.json({ success: true, message: 'Partner deleted.' });
  }

  private static async save(req: Request, res: Response, id: number | null): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'partners/edit', {
        pageTitle: id === null ? 'Add Partner' : 'Edit Partner',
        isCreate: id === null,
        partner: partnerFromBody(body, id),
        error: message,
        errors: fields
      });
    };
    const parsed = safeParseFields(partnerFormSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const logoFile = firstFile(req, 'logoFile');
    let logo: UploadedImage | null = null;
    try {
      logo = logoFile ? await mediaService.saveImage(logoFile, 'partners', 'logo') : null;
      if (!logo && !parsed.data.logo && id === null) {
        renderInvalid('Please correct the highlighted fields.', { logo: 'Upload the partner logo' });
        return;
      }
      const partner = id === null ? await partnersService.create(parsed.data, logo) : await partnersService.update(id, parsed.data, logo);
      setFlash(req, 'success', `${partner.name} saved.`);
      res.redirect('/admin/partners');
    } catch (error) {
      if (logo) {
        await mediaService.discard([logo]);
      }
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
    }
  }
}
