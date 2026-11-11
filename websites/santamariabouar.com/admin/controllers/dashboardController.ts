import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { PagesService } from '../services/pagesService';
import { ProjectsService } from '../services/projectsService';
import { MenuService } from '../services/menuService';
import { ApartmentsService } from '../services/apartmentsService';
import { PaymentsService } from '../services/paymentsService';
import { emailService } from '../../src/services/emailService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const pagesService = PagesService.getInstance();
const projectsService = ProjectsService.getInstance();
const menuDataService = MenuService.getInstance();
const apartmentsService = ApartmentsService.getInstance();
const paymentsService = PaymentsService.getInstance();

const GATE_EXPIRY_EMAIL_LAST_SENT_KEY = 'gate_access_expiry_email_last_sent';

async function processExpiredGateAccessEmail(
  expired: Array<{
    apartmentLabel: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    relation: string;
    expiryDate: string;
  }>
): Promise<void> {
  if (!expired.length) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastSent = await siteSettingsService.getRawSettingValue(GATE_EXPIRY_EMAIL_LAST_SENT_KEY);
  if (lastSent === today) {
    return;
  }

  await emailService.sendGateAccessExpiredDigest(expired);
  await siteSettingsService.setRawSettingValue(GATE_EXPIRY_EMAIL_LAST_SENT_KEY, today);
}

export class DashboardController {
  /**
   * Render admin dashboard
   */
  public static async dashboard(req: Request, res: Response): Promise<void> {
    try {
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get recent pages (last 5)
      const allPages = await pagesService.getAllPages();
      const recentPages = allPages.slice(0, 5);
      
      // Get recent projects (last 5)
      const allProjects = await projectsService.getAllProjects();
      const recentProjects = allProjects.slice(0, 5);
      
      // Get statistics
      const totalPages = allPages.length;
      const totalProjects = allProjects.length;
      const publishedPages = allPages.filter(page => page.status === 'published').length;
      const draftPages = allPages.filter(page => page.status === 'draft').length;
      
      // Get apartment statistics
      const apartmentStats = await apartmentsService.getApartmentStats();
      
      // Get payment statistics
      const paymentStats = await paymentsService.getPaymentStats();
      
      // Get menu data
      const allMenus = await menuDataService.getAllMenus();

      const expiredGateAccess = await apartmentsService.getExpiredGateAccess();
      try {
        await processExpiredGateAccessEmail(expiredGateAccess);
      } catch (emailError) {
        console.error('Expired gate access email failed:', emailError);
      }
      
      res.render('dashboard/dashboard', {
        title: 'Admin Dashboard',
        pageTitle: 'Dashboard',
        pageSubtitle: `Welcome to ${siteTitle || 'CMS'} Admin Panel`,
        siteTitle: siteTitle,
        recentPages,
        recentProjects,
        allProjects,
        menuStatistics: { 
          totalMenus: allMenus.length,
          menuNames: allMenus.map(m => m.name || m.id),
          totalItems: 0
        },
        allMenus,
        apartmentStats,
        paymentStats,
        expiredGateAccess,
        statistics: {
          totalPages,
          totalProjects,
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
      // Get recent pages (last 5)
      const allPages = await pagesService.getAllPages();
      const recentPages = allPages.slice(0, 5);
      
      // Get recent projects (last 5)
      const allProjects = await projectsService.getAllProjects();
      const recentProjects = allProjects.slice(0, 5);
      
      // Get statistics
      const totalPages = allPages.length;
      const totalProjects = allProjects.length;
      const publishedPages = allPages.filter(page => page.status === 'published').length;
      const draftPages = allPages.filter(page => page.status === 'draft').length;
      
      // Get apartment statistics
      const apartmentStats = await apartmentsService.getApartmentStats();
      
      // Get payment statistics
      const paymentStats = await paymentsService.getPaymentStats();
      
      // Get menu statistics
      const allMenus = await menuDataService.getAllMenus();
      
      res.json({
        success: true,
        recentPages,
        recentProjects,
        menuStatistics: { 
          totalMenus: allMenus.length,
          menuNames: allMenus.map(m => m.name || m.id),
          totalItems: 0
        },
        apartmentStats,
        paymentStats,
        statistics: {
          totalPages,
          totalProjects,
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
