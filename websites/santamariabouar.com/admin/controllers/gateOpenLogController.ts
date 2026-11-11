import { Request, Response } from 'express';
import { gateOpenLogService } from '../../src/services/gateOpenLogService';
import { SiteSettingsService } from '../services/siteSettingsService';

const siteSettingsService = SiteSettingsService.getInstance();

export class GateOpenLogController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        search: String(req.query.search || '').trim(),
        fromDate: String(req.query.fromDate || '').trim(),
        toDate: String(req.query.toDate || '').trim()
      };

      const [rows, siteTitle] = await Promise.all([
        gateOpenLogService.list(filters),
        siteSettingsService.getSiteTitle()
      ]);

      res.render('gate-open-log/index', {
        title: 'Gate Open Log',
        pageTitle: 'Gate Open Log',
        pageSubtitle: 'Who opened the main gate and when',
        siteTitle,
        user: (req.session as any).user,
        rows,
        filters,
        totalEntries: rows.length,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error loading gate open log:', error);
      res.status(500).render('admin/error', {
        message: 'Error loading gate open log',
        error
      });
    }
  }
}
