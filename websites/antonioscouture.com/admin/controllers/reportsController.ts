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
}

