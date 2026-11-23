import { Request, Response, NextFunction } from 'express';
import { HomepageSettingsService, cleanHomepageLink, DEFAULT_HOMEPAGE_BANNER_TEXT, DEFAULT_NEW_ARRIVALS_TITLE, DEFAULT_SALE_TITLE } from '../services/homepageSettingsService';
import { StorageService } from '../services/storageService';

const homepageSettingsService = HomepageSettingsService.getInstance();
const storageService = StorageService.getInstance();
const upload = storageService.createHomepageBannerUploadConfig();

export class HomepageController {
  public static handleBannerUpload(req: Request, res: Response, next: NextFunction): void {
    upload.single('banner_image')(req as any, res as any, (err: any) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image is too large. Maximum size is 10MB.'
          : (err.message || 'File upload failed');
        res.redirect('/admin/homepage?error=' + encodeURIComponent(message));
        return;
      }
      next();
    });
  }

  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const settings = await homepageSettingsService.getSettings();
      const t = (res.locals as any).t || ((key: string) => key);
      res.render('homepage/homepage', {
        title: t('homepage.title'),
        pageTitle: t('homepage.title'),
        settings,
        success: typeof req.query['success'] === 'string' ? req.query['success'] : undefined,
        error: typeof req.query['error'] === 'string' ? req.query['error'] : undefined
      });
    } catch (error) {
      console.error('Error rendering homepage settings:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const current = await homepageSettingsService.getSettings();
      const body = req.body || {};
      const file = req.file as Express.Multer.File | undefined;

      let bannerImage = current.bannerImage;
      const removeBanner = body.remove_banner_image === '1' || body.remove_banner_image === 'on';
      if (file) {
        bannerImage = `/images/homepage/${file.filename}`;
      } else if (removeBanner) {
        bannerImage = '';
      }

      const saleEnabled = body.sale_enabled === '1' || body.sale_enabled === 'on' || body.sale_enabled === 'true';

      await homepageSettingsService.updateSettings({
        bannerImage,
        bannerText: String(body.banner_text || '').trim() || DEFAULT_HOMEPAGE_BANNER_TEXT,
        bannerLink: cleanHomepageLink(body.banner_link),
        newArrivalsTitle: String(body.new_arrivals_title || '').trim() || DEFAULT_NEW_ARRIVALS_TITLE,
        saleTitle: String(body.sale_title || '').trim() || DEFAULT_SALE_TITLE,
        saleEnabled,
        saleMetaTitle: String(body.sale_meta_title || '').trim(),
        saleMetaDescription: String(body.sale_meta_description || '').trim()
      });

      res.redirect('/admin/homepage?success=Homepage+settings+saved');
    } catch (error) {
      console.error('Error saving homepage settings:', error);
      res.redirect('/admin/homepage?error=' + encodeURIComponent('Failed to save homepage settings'));
    }
  }
}
