import { Request, Response } from 'express';
import { SiteSettingsService } from '../services/siteSettingsService';
import { ReportsService } from '../services/reportsService';
import { i18nService } from '../services/i18nService';

const siteSettingsService = SiteSettingsService.getInstance();
const reportsService = ReportsService.getInstance();

export class ReportsController {
  /**
   * Reports dashboard
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;

      const salesReport = await reportsService.getSalesReport(dateFrom, dateTo);
      const bestSelling = await reportsService.getBestSellingProducts(10, dateFrom, dateTo);
      const customerAnalytics = await reportsService.getCustomerAnalytics(dateFrom, dateTo);
      const lowStock = await reportsService.getLowStockProducts();
      const discountUsage = await reportsService.getDiscountUsageReport(dateFrom, dateTo);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('reports/reports', {
        title: 'Reports & Analytics',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.reports.title') : 'Reports & Analytics',
        siteTitle,
        t,
        salesReport,
        bestSelling,
        customerAnalytics,
        lowStock,
        discountUsage,
        filters: { dateFrom, dateTo }
      });
    } catch (error) {
      console.error('Error rendering reports page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Low stock report (products and variants)
   */
  public static async lowStock(req: Request, res: Response): Promise<void> {
    try {
      const rawThreshold = req.query.threshold as string | undefined;
      const parsedThreshold = rawThreshold !== undefined && rawThreshold !== ''
        ? parseInt(rawThreshold, 10)
        : 100;
      const threshold = Number.isNaN(parsedThreshold) ? 100 : Math.max(0, parsedThreshold);
      const search = (req.query.search as string | undefined)?.trim() || '';

      const items = await reportsService.getLowStockReport(threshold, search || undefined);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('reports/low-stock', {
        title: 'Low Stock Report',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.reports.lowStockReport') : 'Low Stock Report',
        siteTitle,
        t,
        items,
        filters: { threshold, search }
      });
    } catch (error) {
      console.error('Error rendering low stock report:', error);
      res.status(500).render('admin/error', { error });
    }
  }
}

