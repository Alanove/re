import { Request, Response } from 'express';
import { SiteSettingsService } from '../services/siteSettingsService';
import { PagesService } from '../services/pagesService';
import { MenuService } from '../services/menuService';
import { OrderManagementService } from '../services/orderManagementService';
import { ReportsService } from '../services/reportsService';
import { CustomerManagementService } from '../services/customerManagementService';
import { i18nService } from '../services/i18nService';

const siteSettingsService = SiteSettingsService.getInstance();
const pagesService = PagesService.getInstance();
const menuDataService = MenuService.getInstance();
const orderManagementService = OrderManagementService.getInstance();
const reportsService = ReportsService.getInstance();
const customerManagementService = CustomerManagementService.getInstance();

export class DashboardController {
  /**
   * E-commerce dashboard (default) – latest orders, customers, low inventory
   */
  public static async dashboardEcommerce(req: Request, res: Response): Promise<void> {
    try {
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      // Last 30 days for summary stats
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
    } catch (error) {
      console.error('Error rendering e-commerce dashboard:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * CMS dashboard (secondary) – pages, menus, quick actions
   */
  public static async dashboardCms(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      console.error('Error rendering CMS dashboard:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Get dashboard data for AJAX requests
   */
  public static async dashboardData(req: Request, res: Response): Promise<void> {
    try {
      // Get recent pages (last 5)
      const allPages = await pagesService.getAllPages();
      const recentPages = allPages.slice(0, 5);
      
      // Get statistics
      const totalPages = allPages.length;
      const publishedPages = allPages.filter(page => page.status === 'published').length;
      const draftPages = allPages.filter(page => page.status === 'draft').length;
      
      // Get menu statistics
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
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data'
      });
    }
  }
}
