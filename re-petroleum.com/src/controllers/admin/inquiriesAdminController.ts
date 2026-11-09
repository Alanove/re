import type { Request, Response } from 'express';
import { uuidParamSchema } from '../../schemas/adminSchemas.js';
import { contactService } from '../../services/contactService.js';
import { params, render } from './helpers.js';

export class InquiriesAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'inquiries/list', { pageTitle: 'Inquiries', inquiries: await contactService.list() });
  }

  public static async show(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    const inquiry = await contactService.get(id);
    render(res, 'inquiries/show', { pageTitle: `Inquiry from ${inquiry.name}`, inquiry });
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    await contactService.delete(id);
    res.json({ success: true, message: 'Inquiry deleted.' });
  }
}
