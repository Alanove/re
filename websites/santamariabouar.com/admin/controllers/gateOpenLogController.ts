import { Request, Response } from 'express';
import { gateOpenLogService } from '../../src/services/gateOpenLogService';
import { SiteSettingsService } from '../services/siteSettingsService';

const siteSettingsService = SiteSettingsService.getInstance();

function parsePage(value: unknown): number {
  const page = parseInt(String(value || ''), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export class GateOpenLogController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        search: String(req.query.search || '').trim(),
        fromDate: String(req.query.fromDate || '').trim(),
        toDate: String(req.query.toDate || '').trim()
      };
      const requestedPage = parsePage(req.query.page);

      const [result, siteTitle] = await Promise.all([
        gateOpenLogService.list(filters, requestedPage),
        siteSettingsService.getSiteTitle()
      ]);

      if (requestedPage !== result.page) {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.fromDate) params.set('fromDate', filters.fromDate);
        if (filters.toDate) params.set('toDate', filters.toDate);
        if (result.page > 1) params.set('page', String(result.page));
        const qs = params.toString();
        res.redirect(`/admin/gate-open-log${qs ? `?${qs}` : ''}`);
        return;
      }

      const rangeStart = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
      const rangeEnd = Math.min(result.page * result.pageSize, result.total);

      res.render('gate-open-log/index', {
        title: 'Gate Open Log',
        pageTitle: 'Gate Open Log',
        pageSubtitle: 'Who opened the main gate and when',
        siteTitle,
        user: (req.session as any).user,
        rows: result.rows,
        filters,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
          rangeStart,
          rangeEnd
        },
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
