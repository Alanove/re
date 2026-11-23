"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const siteSettingsService_1 = require("../services/siteSettingsService");
const pagesService_1 = require("../services/pagesService");
const menuService_1 = require("../services/menuService");
const orderManagementService_1 = require("../services/orderManagementService");
const reportsService_1 = require("../services/reportsService");
const customerManagementService_1 = require("../services/customerManagementService");
const i18nService_1 = require("../services/i18nService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const pagesService = pagesService_1.PagesService.getInstance();
const menuDataService = menuService_1.MenuService.getInstance();
const orderManagementService = orderManagementService_1.OrderManagementService.getInstance();
const reportsService = reportsService_1.ReportsService.getInstance();
const customerManagementService = customerManagementService_1.CustomerManagementService.getInstance();
class DashboardController {
    static async dashboardEcommerce(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const dateTo = new Date();
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - 30);
            const dateFromStr = dateFrom.toISOString().split('T')[0];
            const dateToStr = dateTo.toISOString().split('T')[0];
            const [recentOrdersResult, salesReport, customerAnalytics, lowStock, recentCustomersResult] = await Promise.all([
                orderManagementService.getAllOrders(1, 10),
                reportsService.getSalesReport(dateFromStr, dateToStr),
                reportsService.getCustomerAnalytics(dateFromStr, dateToStr),
                reportsService.getLowStockProducts().then(rows => rows.slice(0, 10)),
                customerManagementService.getAllCustomers(1, 8)
            ]);
            res.render('dashboard/ecommerce', {
                title: 'E-commerce Dashboard',
                pageTitle: typeof t !== 'undefined' ? t('dashboard.ecommerce') : 'E-commerce Dashboard',
                pageSubtitle: typeof t !== 'undefined' ? t('dashboard.ecommerceSubtitle') : 'Orders, customers & inventory',
                siteTitle,
                t,
                recentOrders: recentOrdersResult.orders,
                salesReport,
                customerAnalytics,
                lowStock,
                recentCustomers: recentCustomersResult.customers,
                dashboardView: 'ecommerce'
            });
        }
        catch (error) {
            console.error('Error rendering e-commerce dashboard:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async dashboardCms(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const allPages = await pagesService.getAllPages();
            const recentPages = allPages.slice(0, 5);
            const totalPages = allPages.length;
            const publishedPages = allPages.filter(page => page.status === 'published').length;
            const draftPages = allPages.filter(page => page.status === 'draft').length;
            const allMenus = await menuDataService.getAllMenus();
            res.render('dashboard/dashboard', {
                title: 'CMS Dashboard',
                pageTitle: 'CMS Dashboard',
                pageSubtitle: `Content & menus – ${siteTitle || 'CMS'}`,
                siteTitle,
                recentPages,
                menuStatistics: {
                    totalMenus: allMenus.length,
                    menuNames: allMenus.map(m => m.name || m.id),
                    totalItems: 0
                },
                allMenus,
                statistics: { totalPages, publishedPages, draftPages },
                dashboardView: 'cms'
            });
        }
        catch (error) {
            console.error('Error rendering CMS dashboard:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async dashboardData(req, res) {
        try {
            const allPages = await pagesService.getAllPages();
            const recentPages = allPages.slice(0, 5);
            const totalPages = allPages.length;
            const publishedPages = allPages.filter(page => page.status === 'published').length;
            const draftPages = allPages.filter(page => page.status === 'draft').length;
            const allMenus = await menuDataService.getAllMenus();
            res.json({
                success: true,
                recentPages,
                menuStatistics: {
                    totalMenus: allMenus.length,
                    menuNames: allMenus.map(m => m.name || m.id),
                    totalItems: 0
                },
                statistics: {
                    totalPages,
                    publishedPages,
                    draftPages
                }
            });
        }
        catch (error) {
            console.error('Error getting dashboard data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get dashboard data'
            });
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboardController.js.map