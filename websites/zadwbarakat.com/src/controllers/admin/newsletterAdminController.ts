import type { Request, Response } from 'express';
import { uuidParamSchema } from '../../schemas/adminSchemas.js';
import { newsletterService } from '../../services/newsletterService.js';
import { params, render } from './helpers.js';

export class NewsletterAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'newsletter/list', { pageTitle: 'Newsletter subscribers', rows: await newsletterService.list() });
  }

  public static async exportCsv(_req: Request, res: Response): Promise<void> {
    const csv = await newsletterService.exportCsv();
    res.set('Content-Disposition', `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv; charset=utf-8').send(csv);
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(uuidParamSchema, req);
    await newsletterService.remove(id);
    res.json({ success: true, message: 'Subscriber removed.' });
  }
}
