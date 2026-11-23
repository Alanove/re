import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { ProductAttributeService } from '../services/productAttributeService';
import { i18nService } from '../services/i18nService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const productAttributeService = ProductAttributeService.getInstance();

export class ProductAttributesController {
  /**
   * Product attributes list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const productAttributes = await productAttributeService.getAllProductAttributes(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('product-attributes/product-attributes', {
        title: 'Product Attributes',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.productAttributes.title') : 'Product Attributes',
        siteTitle,
        t,
        productAttributes
      });
    } catch (error) {
      console.error('Error rendering product attributes page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create product attribute page
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const csrfToken = (res.locals as any).csrfToken || '';

      res.render('product-attributes/create-product-attribute', {
        title: 'Create Product Attribute',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.productAttributes.create') : 'Create Product Attribute',
        siteTitle,
        t,
        csrfToken
      });
    } catch (error) {
      console.error('Error rendering create product attribute page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create product attribute (POST)
   */
  public static async createPost(req: Request, res: Response): Promise<void> {
    try {
      const { name, slug, description, has_image, display_order, values } = req.body;

      const valuesArray = typeof values === 'string'
        ? values.split(',').map((v: string) => v.trim()).filter((v: string) => v)
        : Array.isArray(values) ? values.map((v: string) => v.trim()).filter((v: string) => v) : [];

      await productAttributeService.createProductAttribute({
        name,
        slug,
        description,
        has_image: has_image === 'true' || has_image === 'on',
        display_order: display_order ? parseInt(display_order) : 0,
        values: valuesArray
      });

      res.redirect('/admin/product-attributes?success=Product attribute created successfully');
    } catch (error: any) {
      console.error('Error creating product attribute:', error);
      res.redirect(`/admin/product-attributes/create?error=${encodeURIComponent(error.message || 'Failed to create product attribute')}`);
    }
  }

  /**
   * Edit product attribute page
   */
  public static async edit(req: Request, res: Response): Promise<void> {
    try {
      const productAttributeId = parseInt(req.params.id);
      const productAttribute = await productAttributeService.getProductAttributeById(productAttributeId);

      if (!productAttribute) {
        res.status(404).render('admin/error', { error: 'Product attribute not found' });
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const csrfToken = (res.locals as any).csrfToken || '';

      // Get messages from query string
      const success = req.query.success as string | undefined;
      const error = req.query.error as string | undefined;

      res.render('product-attributes/edit-product-attribute', {
        title: `Edit Product Attribute - ${productAttribute.name}`,
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.productAttributes.edit') : `Edit Product Attribute - ${productAttribute.name}`,
        siteTitle,
        t,
        productAttribute,
        csrfToken,
        success,
        error
      });
    } catch (error) {
      console.error('Error rendering edit product attribute page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update product attribute (POST)
   */
  public static async editPost(req: Request, res: Response): Promise<void> {
    try {
      const productAttributeId = parseInt(req.params.id);
      const { name, slug, description, has_image, display_order, is_active, values_json } = req.body;

      // Update the attribute itself
      await productAttributeService.updateProductAttribute(productAttributeId, {
        name,
        slug,
        description,
        has_image: has_image === 'true' || has_image === 'on',
        display_order: display_order ? parseInt(display_order) : 0,
        is_active: is_active === 'true' || is_active === 'on'
      });

      // Update values if provided as JSON (from edit UI)
      if (values_json) {
        const valuesData = JSON.parse(values_json);
        await productAttributeService.updateAttributeValues(productAttributeId, valuesData);
      }

      res.redirect(`/admin/product-attributes/${productAttributeId}/edit?success=Product attribute updated successfully`);
    } catch (error: any) {
      console.error('Error updating product attribute:', error);
      res.redirect(`/admin/product-attributes/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update product attribute')}`);
    }
  }

  /**
   * Delete product attribute
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const productAttributeId = parseInt(req.params.id);

      // Get attribute details first to get the name
      const attribute = await productAttributeService.getProductAttributeById(productAttributeId);
      if (!attribute) {
        res.status(404).json({ success: false, error: 'Product attribute not found' });
        return;
      }

      // Check if attribute is used by any products
      const productsUsingAttribute = await productAttributeService.checkAttributeUsage(attribute.name);

      if (productsUsingAttribute.length > 0) {
        const topProducts = productsUsingAttribute.slice(0, 5);
        const moreCount = productsUsingAttribute.length - 5;
        const productList = topProducts.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '');

        res.status(400).json({
          success: false,
          error: `Cannot delete attribute "${attribute.name}" because it is used by the following products: ${productList}. Please remove this attribute from these products first.`
        });
        return;
      }

      await productAttributeService.deleteProductAttribute(productAttributeId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting product attribute:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete product attribute' });
    }
  }

  /**
   * Check if attribute value is used (API)
   */
  public static async checkValueUsage(req: Request, res: Response): Promise<void> {
    try {
      const valueId = parseInt(req.params.id);
      const productsUsingValue = await productAttributeService.checkAttributeValueUsage(valueId);

      if (productsUsingValue.length > 0) {
        const topProducts = productsUsingValue.slice(0, 5);
        const moreCount = productsUsingValue.length - 5;
        const productList = topProducts.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '');

        res.json({
          used: true,
          message: `Current attribute value is used by products: ${productList}`
        });
      } else {
        res.json({ used: false });
      }
    } catch (error: any) {
      console.error('Error checking value usage:', error);
      res.status(500).json({ error: error.message || 'Failed to check usage' });
    }
  }

  /**
   * Get product attributes (API)
   */
  public static async getProductAttributes(req: Request, res: Response): Promise<void> {
    try {
      const productAttributes = await productAttributeService.getAllProductAttributes();
      res.json({ success: true, productAttributes });
    } catch (error: any) {
      console.error('Error getting product attributes:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get product attributes' });
    }
  }
}
