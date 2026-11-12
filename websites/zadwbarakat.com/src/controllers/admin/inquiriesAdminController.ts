import type { Request, Response } from 'express';
import { inquiriesQuerySchema, uuidParamSchema } from '../../schemas/adminSchemas.js';
import { contactService } from '../../services/contactService.js';
import { params, render } from './helpers.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'contact', label: 'Messages' },
  { value: 'purchase', label: 'Purchase requests' }
] as const;

export class InquiriesAdminController {
  public static async list(req: Request, res: Response): Promise<void> {
    const query = inquiriesQuerySchema.parse(req.query);
    const type = query.type ?? null;
    render(res, 'inquiries/list', {
      pageTitle: type === 'purchase' ? 'Purchase requests' : 'Inquiries',
      inquiries: await contactService.list(type),
      filters: FILTERS,
      activeType: type ?? ''
    });
  }

  public static async show(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    const inquiry = await contactService.get(id);
    render(res, 'inquiries/show', {
      pageTitle: inquiry.type === 'purchase' ? `Purchase request from ${inquiry.name}` : `Inquiry from ${inquiry.name}`,
      inquiry
    });
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    await contactService.delete(id);
    res.json({ success: true, message: 'Inquiry deleted.' });
  }
}
