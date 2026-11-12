import type { Request, Response } from 'express';
import { inquiriesQuerySchema, uuidParamSchema } from '../../schemas/adminSchemas.js';
import { contactService, describePledge } from '../../services/contactService.js';
import { params, render } from './helpers.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'contact', label: 'Messages' },
  { value: 'donation', label: 'Donation pledges' }
] as const;

export class InquiriesAdminController {
  public static async list(req: Request, res: Response): Promise<void> {
    const query = inquiriesQuerySchema.parse(req.query);
    const type = query.type ?? null;
    render(res, 'inquiries/list', {
      pageTitle: type === 'donation' ? 'Donation pledges' : 'Inquiries',
      inquiries: (await contactService.list(type)).map((item) => ({ ...item, pledge: item.donation ? describePledge(item.donation) : '' })),
      filters: FILTERS,
      activeType: type ?? ''
    });
  }

  public static async show(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    const inquiry = await contactService.get(id);
    render(res, 'inquiries/show', {
      pageTitle: inquiry.type === 'donation' ? `Pledge from ${inquiry.name}` : `Inquiry from ${inquiry.name}`,
      inquiry,
      pledge: inquiry.donation ? describePledge(inquiry.donation) : ''
    });
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    await contactService.delete(id);
    res.json({ success: true, message: 'Inquiry deleted.' });
  }
}
