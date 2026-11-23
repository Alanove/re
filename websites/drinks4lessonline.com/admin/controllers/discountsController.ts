import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { DiscountManagementService } from '../services/discountManagementService';
import { i18nService } from '../services/i18nService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const discountService = DiscountManagementService.getInstance();

export class DiscountsController {
  /**
   * Discounts list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const is_active = req.query.is_active === 'true' ? true : undefined;

      const filters: { search?: string; is_active?: boolean } = {};
      if (search) filters.search = search;
      if (is_active !== undefined) filters.is_active = is_active;

      const result = await discountService.getAllDiscounts(page, limit, filters);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('discounts/discounts', {
        title: 'Discounts',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.discounts.title') : 'Discounts',
        siteTitle,
        t,
        discounts: result.discounts,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        filters: { search, is_active }
      });
    } catch (error) {
      console.error('Error rendering discounts page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create discount page (GET)
   */
  public static async createDiscount(req: Request, res: Response): Promise<void> {
    try {
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('discounts/create-discount', {
        title: typeof t !== 'undefined' ? t('ecommerce.discounts.createDiscount') : 'Create Discount',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.discounts.createDiscount') : 'Create Discount',
        siteTitle,
        t
      });
    } catch (error) {
      console.error('Error rendering create discount page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create discount (POST)
   */
  public static async createDiscountPost(req: Request, res: Response): Promise<void> {
    try {
      const discountData: {
        code: string;
        name: string;
        description?: string;
        type: 'percentage' | 'fixed_amount';
        value: number;
        minimum_purchase?: number;
        maximum_discount?: number;
        usage_limit?: number;
        usage_limit_per_customer?: number;
        start_date?: string;
        end_date?: string;
        is_active: boolean;
        applies_to?: 'all' | 'products' | 'categories';
        product_ids?: number[];
        category_ids?: number[];
        first_time_customer_only: boolean;
      } = {
        code: req.body.code,
        name: req.body.name,
        type: req.body.type,
        value: parseFloat(req.body.value),
        is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off',
        applies_to: req.body.applies_to || 'all',
        first_time_customer_only: req.body.first_time_customer_only === 'true' || req.body.first_time_customer_only === 'on'
      };

      if (req.body.description) discountData.description = req.body.description;
      if (req.body.minimum_purchase) discountData.minimum_purchase = parseFloat(req.body.minimum_purchase);
      if (req.body.maximum_discount) discountData.maximum_discount = parseFloat(req.body.maximum_discount);
      if (req.body.usage_limit) discountData.usage_limit = parseInt(req.body.usage_limit);
      if (req.body.usage_limit_per_customer) discountData.usage_limit_per_customer = parseInt(req.body.usage_limit_per_customer);
      if (req.body.start_date) discountData.start_date = req.body.start_date;
      if (req.body.end_date) discountData.end_date = req.body.end_date;
      if (req.body.applies_to) discountData.applies_to = req.body.applies_to;
      if (req.body.product_ids) discountData.product_ids = JSON.parse(req.body.product_ids);
      if (req.body.category_ids) discountData.category_ids = JSON.parse(req.body.category_ids);

      const discount = await discountService.createDiscount(discountData);

      res.redirect(`/admin/discounts/${discount.id}/edit?success=Discount created successfully`);
    } catch (error: any) {
      console.error('Error creating discount:', error);
      res.redirect(`/admin/discounts/create?error=${encodeURIComponent(error.message || 'Failed to create discount')}`);
    }
  }

  /**
   * Edit discount page (GET)
   */
  public static async editDiscount(req: Request, res: Response): Promise<void> {
    try {
      const discountId = parseInt(req.params.id);
      const discount = await discountService.getDiscountById(discountId);

      if (!discount) {
        res.status(404).render('admin/error', { error: 'Discount not found' });
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('discounts/edit-discount', {
        title: typeof t !== 'undefined' ? t('ecommerce.discounts.editDiscount') : 'Edit Discount',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.discounts.editDiscount') : 'Edit Discount',
        siteTitle,
        t,
        discount
      });
    } catch (error) {
      console.error('Error rendering edit discount page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update discount (POST)
   */
  public static async editDiscountPost(req: Request, res: Response): Promise<void> {
    try {
      const discountId = parseInt(req.params.id);
      const discountData: any = {};

      if (req.body.code) discountData.code = req.body.code;
      if (req.body.name) discountData.name = req.body.name;
      if (req.body.description !== undefined) discountData.description = req.body.description;
      if (req.body.type) discountData.type = req.body.type;
      if (req.body.value) discountData.value = parseFloat(req.body.value);
      if (req.body.minimum_purchase !== undefined) discountData.minimum_purchase = req.body.minimum_purchase ? parseFloat(req.body.minimum_purchase) : null;
      if (req.body.maximum_discount !== undefined) discountData.maximum_discount = req.body.maximum_discount ? parseFloat(req.body.maximum_discount) : null;
      if (req.body.usage_limit !== undefined) discountData.usage_limit = req.body.usage_limit ? parseInt(req.body.usage_limit) : null;
      if (req.body.usage_limit_per_customer !== undefined) discountData.usage_limit_per_customer = req.body.usage_limit_per_customer ? parseInt(req.body.usage_limit_per_customer) : null;
      if (req.body.start_date !== undefined) discountData.start_date = req.body.start_date || null;
      if (req.body.end_date !== undefined) discountData.end_date = req.body.end_date || null;
      if (req.body.is_active !== undefined) discountData.is_active = req.body.is_active !== 'false' && req.body.is_active !== 'off';
      if (req.body.applies_to) discountData.applies_to = req.body.applies_to;
      if (req.body.product_ids !== undefined) discountData.product_ids = req.body.product_ids ? JSON.parse(req.body.product_ids) : null;
      if (req.body.category_ids !== undefined) discountData.category_ids = req.body.category_ids ? JSON.parse(req.body.category_ids) : null;
      if (req.body.first_time_customer_only !== undefined) discountData.first_time_customer_only = req.body.first_time_customer_only === 'true' || req.body.first_time_customer_only === 'on';

      await discountService.updateDiscount(discountId, discountData);

      res.redirect(`/admin/discounts/${discountId}/edit?success=Discount updated successfully`);
    } catch (error: any) {
      console.error('Error updating discount:', error);
      res.redirect(`/admin/discounts/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update discount')}`);
    }
  }

  /**
   * Delete discount
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const discountId = parseInt(req.params.id);
      await discountService.deleteDiscount(discountId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting discount:', error);
      res.status(500).json({ error: 'Failed to delete discount' });
    }
  }
}

