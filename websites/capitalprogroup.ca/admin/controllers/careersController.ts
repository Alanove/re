import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { careersService, CareerData } from '../services/careersService';
import { SiteSettingsService } from '../services/siteSettingsService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class CareersController {
  /**
   * Render careers management page
   */
  public static async careers(req: Request, res: Response): Promise<void> {
    try {
      menuService.setActiveMenuItem('/admin/careers');
      const adminMenu = menuService.getMenuItems();
      const careers = careersService.getAllCareers();
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('careers/careers', {
        title: 'Careers Management',
        pageTitle: 'Careers Management',
        pageSubtitle: 'Manage your career listings',
        careers: careers,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        pageCSS: ''
      });
    } catch (error) {
      console.error('Error rendering careers:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create career form
   */
  public static async createCareer(req: Request, res: Response): Promise<void> {
    try {
      menuService.setActiveMenuItem('/admin/careers');
      const siteTitle = siteSettingsService.getSiteTitle();
      
      const emptyCareer: CareerData = {
        id: '',
        title: '',
        content: '',
        status: 'draft'
      };
      
      res.render('careers/edit-career', {
        title: 'Create Career',
        pageTitle: 'Create Career',
        pageSubtitle: 'Add a new career listing',
        career: emptyCareer,
        careerId: '',
        isCreateMode: true,
        siteTitle: siteTitle,
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering create career:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create career form submission
   */
  public static async createCareerPost(req: Request, res: Response): Promise<void> {
    try {
      const { title, content, status } = req.body;
      
      // Validation
      if (!title || !content) {
        return res.redirect('/admin/careers/create?error=Title and content are required');
      }

      const newCareer = careersService.createCareer({
        title: title.trim(),
        content: content.trim(),
        status: (status === 'published' ? 'published' : 'draft') as 'published' | 'draft'
      });

      res.redirect(`/admin/careers?success=Career "${newCareer.title}" created successfully`);
    } catch (error) {
      console.error('Error creating career:', error);
      res.redirect('/admin/careers/create?error=Failed to create career');
    }
  }

  /**
   * Render edit career form
   */
  public static async editCareer(req: Request, res: Response): Promise<void> {
    try {
      const careerId = req.params['id'];
      const career = careersService.getCareerById(careerId);
      
      if (!career) {
        return res.redirect('/admin/careers?error=Career not found');
      }

      menuService.setActiveMenuItem('/admin/careers');
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('careers/edit-career', {
        title: 'Edit Career',
        pageTitle: 'Edit Career',
        pageSubtitle: 'Update career listing',
        career: career,
        careerId: careerId,
        isCreateMode: false,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        includeCustomEditor: true
      });
    } catch (error) {
      console.error('Error rendering edit career:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit career form submission
   */
  public static async editCareerPost(req: Request, res: Response): Promise<void> {
    try {
      const careerId = req.params['id'];
      const { title, content, status } = req.body;
      
      const career = careersService.getCareerById(careerId);
      if (!career) {
        return res.redirect('/admin/careers?error=Career not found');
      }

      // Validation
      if (!title || !content) {
        return res.redirect(`/admin/careers/${careerId}/edit?error=Title and content are required`);
      }

      careersService.updateCareer(careerId, {
        title: title.trim(),
        content: content.trim(),
        status: (status === 'published' ? 'published' : 'draft') as 'published' | 'draft'
      });

      res.redirect(`/admin/careers?success=Career "${title}" updated successfully`);
    } catch (error) {
      console.error('Error updating career:', error);
      res.redirect(`/admin/careers/${req.params['id']}/edit?error=Failed to update career`);
    }
  }

  /**
   * Delete career
   */
  public static async deleteCareer(req: Request, res: Response): Promise<void> {
    try {
      const careerId = req.params['id'];
      const career = careersService.getCareerById(careerId);
      
      if (!career) {
        res.status(404).json({ success: false, message: 'Career not found' });
        return;
      }

      careersService.deleteCareer(careerId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting career:', error);
      res.status(500).json({ success: false, message: 'Failed to delete career' });
    }
  }

}

