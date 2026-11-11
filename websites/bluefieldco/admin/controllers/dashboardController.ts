import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { PagesService } from '../services/pagesService';
import { MenuService } from '../services/menuService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const pagesService = PagesService.getInstance();
const menuDataService = MenuService.getInstance();

export class DashboardController {
  /**
   * Render admin dashboard
   */
  public static async dashboard(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/dashboard');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get recent pages (last 5 updated, or last 5 if no updates)
      const allPages = pagesService.getAllPages();
      let recentPages = allPages
        .filter(page => page.lastUpdated)
        .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
        .slice(0, 5);
      
      // If no pages with lastUpdated, show last 5 pages
      if (recentPages.length === 0) {
        recentPages = allPages.slice(-5).reverse();
      }
      
      // Get statistics
      const totalPages = pagesService.getPagesCount();
      const publishedPages = allPages.filter(page => page.status === 'published').length;
      const draftPages = allPages.filter(page => page.status === 'draft').length;
      
      // Get menu statistics and menu data
      const menuStatistics = menuDataService.getMenuStatistics();
      const allMenus = menuDataService.getAllMenus();
      
      res.render('dashboard/dashboard', {
        title: 'Admin Dashboard',
        pageTitle: 'Dashboard',
        pageSubtitle: `Welcome to ${siteTitle || 'CMS'} Admin Panel`,
        siteTitle: siteTitle,
        recentPages,
        menuStatistics,
        allMenus,
        statistics: {
          totalPages,
          publishedPages,
          draftPages
        }
      });
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Get dashboard data for AJAX requests
   */
  public static async dashboardData(req: Request, res: Response): Promise<void> {
    try {
      // Get recent pages (last 5 updated, or last 5 if no updates)
      const allPages = pagesService.getAllPages();
      let recentPages = allPages
        .filter(page => page.lastUpdated)
        .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
        .slice(0, 5);
      
      // If no pages with lastUpdated, show last 5 pages
      if (recentPages.length === 0) {
        recentPages = allPages.slice(-5).reverse();
      }
      
      // Get statistics
      const totalPages = pagesService.getPagesCount();
      const publishedPages = allPages.filter(page => page.status === 'published').length;
      const draftPages = allPages.filter(page => page.status === 'draft').length;
      
      // Get menu statistics
      const menuStatistics = menuDataService.getMenuStatistics();
      
      res.json({
        success: true,
        recentPages,
        menuStatistics,
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