import { Request, Response } from 'express';
import { SliderService } from '../../admin/services/sliderService';
import { apartmentsService } from '../../admin/services/apartmentsService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import pagesService from '../services/pagesService';

const sliderService = SliderService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class HomeController {
  /**
   * Render home page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      sliderService.reloadData();
      const slides = await sliderService.getActiveSlides();

      const [apartmentsForRent, apartmentsForSale, siteSettings, welcomeNote] = await Promise.all([
        apartmentsService.getRecentApartmentsByStatus('for_rent', 3),
        apartmentsService.getRecentApartmentsByStatus('for_sale', 3),
        siteSettingsService.getAllSettings(),
        pagesService.getPageBySlug('welcome-note')
      ]);

      const welcomeImage =
        welcomeNote?.seoImage || welcomeNote?.backgroundImage || '';

      res.render('index', {
        slides,
        apartmentsForRent,
        apartmentsForSale,
        siteSettings,
        welcomeTitle: welcomeNote?.title || 'Welcome Note',
        welcomeContent: welcomeNote?.content || '',
        welcomeImage,
        includeSlideshowAssets: true
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
