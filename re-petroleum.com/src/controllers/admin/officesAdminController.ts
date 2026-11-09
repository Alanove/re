import type { Request, Response } from 'express';
import type { Office } from '../../domain/models.js';
import { safeParseFields } from '../../middleware/validate.js';
import { officeFormSchema, stringIdParamSchema } from '../../schemas/adminSchemas.js';
import { officesService } from '../../services/officesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

function blankOffice(): Office {
  return { id: '', country: '', role: '', address: '', poBox: '', phones: [], fax: '', emails: [], mapQuery: '', isPrimary: false, sort: 100 };
}

function officeFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return {
    id: text('id'),
    country: text('country'),
    role: text('role'),
    address: text('address'),
    poBox: text('poBox'),
    phones: text('phones').split(/\r?\n/),
    fax: text('fax'),
    emails: text('emails').split(/\r?\n/),
    mapQuery: text('mapQuery'),
    isPrimary: Boolean(body.isPrimary),
    sort: text('sort')
  };
}

export class OfficesAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'offices/list', { pageTitle: 'Offices', offices: await officesService.list() });
  }

  public static createForm(_req: Request, res: Response): void {
    render(res, 'offices/edit', { pageTitle: 'Add Office', isCreate: true, office: blankOffice(), originalId: '' });
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    const office = await officesService.get(id);
    render(res, 'offices/edit', { pageTitle: `Office: ${office.country}`, isCreate: false, office, originalId: office.id });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    await OfficesAdminController.save(req, res, null);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    await OfficesAdminController.save(req, res, id);
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    await officesService.delete(id);
    res.json({ success: true, message: 'Office deleted.' });
  }

  private static async save(req: Request, res: Response, previousId: string | null): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'offices/edit', {
        pageTitle: previousId ? 'Edit Office' : 'Add Office',
        isCreate: previousId === null,
        office: officeFromBody(body),
        originalId: previousId ?? '',
        error: message,
        errors: fields
      });
    };
    const parsed = safeParseFields(officeFormSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      const office = await officesService.save(parsed.data, previousId);
      setFlash(req, 'success', `${office.country} office saved.`);
      res.redirect('/admin/offices');
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
    }
  }
}
