"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const siteSettingsService_1 = require("../services/siteSettingsService");
const reportsService_1 = require("../services/reportsService");
const i18nService_1 = require("../services/i18nService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const reportsService = reportsService_1.ReportsService.getInstance();
class ReportsController {
    static async index(req, res) {
        try {
            const dateFrom = req.query.date_from;
            const dateTo = req.query.date_to;
            const salesReport = await reportsService.getSalesReport(dateFrom, dateTo);
            const bestSelling = await reportsService.getBestSellingProducts(10, dateFrom, dateTo);
            const customerAnalytics = await reportsService.getCustomerAnalytics(dateFrom, dateTo);
            const lowStock = await reportsService.getLowStockProducts();
            const discountUsage = await reportsService.getDiscountUsageReport(dateFrom, dateTo);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
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
        }
        catch (error) {
            console.error('Error rendering reports page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async lowStock(req, res) {
        try {
            const rawThreshold = req.query.threshold;
            const parsedThreshold = rawThreshold !== undefined && rawThreshold !== ''
                ? parseInt(rawThreshold, 10)
                : 100;
            const threshold = Number.isNaN(parsedThreshold) ? 100 : Math.max(0, parsedThreshold);
            const search = req.query.search?.trim() || '';
            const items = await reportsService.getLowStockReport(threshold, search || undefined);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('reports/low-stock', {
                title: 'Low Stock Report',
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.reports.lowStockReport') : 'Low Stock Report',
                siteTitle,
                t,
                items,
                filters: { threshold, search }
            });
        }
        catch (error) {
            console.error('Error rendering low stock report:', error);
            res.status(500).render('admin/error', { error });
        }
    }
}
exports.ReportsController = ReportsController;
//# sourceMappingURL=reportsController.js.map