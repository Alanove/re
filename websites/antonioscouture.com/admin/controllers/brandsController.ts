import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { BrandManagementService, BrandData } from '../services/brandManagementService';
import { i18nService } from '../services/i18nService';
import { StorageService } from '../services/storageService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const brandService = BrandManagementService.getInstance();
const storageService = StorageService.getInstance();

export class BrandsController {
  /**
   * Brands list page – always from brands table via BrandManagementService (same DB as frontend).
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      // Single source of truth: all brands from DB (active + inactive) for admin
      let brands: any[] = [];
      try {
        const allBrands = await brandService.getAllBrands(true);
        brands = Array.isArray(allBrands) ? allBrands : [];
      } catch (err) {
        console.error('BrandManagementService.getAllBrands failed, using frontend service:', err);
        const frontendBrandService = (await import('../../src/services/brandService')).default;
        const active = await frontendBrandService.getActiveBrands();
        brands = Array.isArray(active) ? active.map((b: any) => ({ ...b, is_active: b.is_active ?? true })) : [];
      }
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('brands/brands', {
        title: 'Brands',
        pageTitle: 'Brands Management',
        siteTitle,
        t,
        brands,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error rendering brands page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create brand page (GET)
   */
  public static async createBrand(req: Request, res: Response): Promise<void> {
    try {
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('brands/create-brand', {
        title: 'Create Brand',
        pageTitle: 'Create New Brand',
        siteTitle,
        t
      });
    } catch (error) {
      console.error('Error rendering create brand page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create brand (POST)
   */
  public static async createBrandPost(req: Request, res: Response): Promise<void> {
    try {
      const { name, slug, description, website_url, is_featured, display_order, is_active, meta_title, meta_description, meta_keywords } = req.body;

      const brandData: {
        name: string;
        slug?: string | undefined;
        description?: string | undefined;
        logo_url?: string | undefined;
        website_url?: string | undefined;
        is_featured: boolean;
        display_order: number;
        is_active: boolean;
        meta_title?: string | undefined;
        meta_description?: string | undefined;
        meta_keywords?: string | undefined;
      } = {
        name,
        is_featured: is_featured === 'true' || is_featured === 'on',
        display_order: display_order ? parseInt(display_order) : 0,
        is_active: is_active === 'true' || is_active === 'on' || is_active === undefined
      };

      if (req.file) {
        brandData.logo_url = await storageService.saveBrandLogo(req.file);
      }
      if (slug) brandData.slug = slug;
      if (description) brandData.description = description;
      if (website_url) brandData.website_url = website_url;
      if (meta_title) brandData.meta_title = meta_title;
      if (meta_description) brandData.meta_description = meta_description;
      if (meta_keywords) brandData.meta_keywords = meta_keywords;

      await brandService.createBrand(brandData);

      res.redirect('/admin/brands?success=Brand created successfully');
    } catch (error: any) {
      console.error('Error creating brand:', error);
      res.redirect(`/admin/brands/create?error=${encodeURIComponent(error.message || 'Failed to create brand')}`);
    }
  }

  /**
   * Edit brand page (GET)
   */
  public static async editBrand(req: Request, res: Response): Promise<void> {
    try {
      const brandId = parseInt(req.params.id);
      const brand = await brandService.getBrandById(brandId);

      if (!brand) {
        res.status(404).render('admin/error', { error: 'Brand not found' });
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('brands/edit-brand', {
        title: `Edit Brand - ${brand.name}`,
        pageTitle: `Edit Brand - ${brand.name}`,
        siteTitle,
        t,
        brand
      });
    } catch (error) {
      console.error('Error rendering edit brand page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update brand (POST)
   */
  public static async editBrandPost(req: Request, res: Response): Promise<void> {
    try {
      const brandId = parseInt(req.params.id);
      const { name, slug, description, website_url, is_featured, display_order, is_active, meta_title, meta_description, meta_keywords, delete_logo } = req.body;

      const updateData: Partial<BrandData> = {};

      if (name) updateData.name = name;
      if (is_featured !== undefined) updateData.is_featured = is_featured === 'true' || is_featured === 'on';
      if (display_order !== undefined) updateData.display_order = display_order ? parseInt(display_order) : 0;
      if (is_active !== undefined) updateData.is_active = is_active === 'true' || is_active === 'on';

      if (delete_logo === 'true') {
        updateData.logo_url = undefined;
      } else if (req.file) {
        updateData.logo_url = await storageService.saveBrandLogo(req.file);
      }
      if (slug) updateData.slug = slug;
      if (description) updateData.description = description;
      if (website_url) updateData.website_url = website_url;
      if (meta_title) updateData.meta_title = meta_title;
      if (meta_description) updateData.meta_description = meta_description;
      if (meta_keywords) updateData.meta_keywords = meta_keywords;

      await brandService.updateBrand(brandId, updateData);

      res.redirect(`/admin/brands/${brandId}/edit?success=Brand updated successfully`);
    } catch (error: any) {
      console.error('Error updating brand:', error);
      res.redirect(`/admin/brands/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update brand')}`);
    }
  }

  /**
   * Delete brand (POST)
   */
  public static async deleteBrand(req: Request, res: Response): Promise<void> {
    try {
      const brandId = parseInt(req.params.id);
      await brandService.deleteBrand(brandId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete brand' });
    }
  }

  /**
   * Delete brand logo (DELETE)
   */
  public static async deleteBrandLogo(req: Request, res: Response): Promise<void> {
    try {
      const brandId = parseInt(req.params.id);
      await brandService.updateBrand(brandId, { logo_url: undefined as string | undefined });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting brand logo:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete brand logo' });
    }
  }
}
