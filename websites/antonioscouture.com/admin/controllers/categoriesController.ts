import { Request, Response } from 'express';
import path from 'path';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { CategoryManagementService } from '../services/categoryManagementService';
import { i18nService } from '../services/i18nService';
import { StorageService } from '../services/storageService';
import { getPublicUrl, DATA_PATHS } from '../../src/constants/data-paths';
import {
  generateThumbForPublicUrl,
  deleteThumbFileForSourceImageUrl,
} from '../../src/services/imageThumbService';
import storefrontMiddlewareService from '../../src/services/middlewareService';
import { ProductManagementService } from '../services/productManagementService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const categoryService = CategoryManagementService.getInstance();
const productService = ProductManagementService.getInstance();
const storageService = StorageService.getInstance();
const categoryMediaUpload = storageService.createCategoryUploadConfig();

async function refreshStorefrontCategoryCaches(): Promise<void> {
  try {
    await storefrontMiddlewareService.invalidateCategoryCaches();
  } catch (e) {
    console.error('Failed to refresh storefront category caches:', e);
  }
}

function categoryFileFromReq(req: Request, field: 'image' | 'video'): Express.Multer.File | undefined {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return files?.[field]?.[0];
}

export class CategoriesController {
  /**
   * Categories list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      // Debug: Log categories with images
      categories.forEach((cat: any) => {
        if (cat.image_url) {
          console.log(`Category "${cat.name}" has image_url:`, cat.image_url);
        }
      });

      res.render('categories/categories', {
        title: 'Categories',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.title') : 'Categories',
        siteTitle,
        t,
        categories
      });
    } catch (error) {
      console.error('Error rendering categories page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create category page (GET)
   */
  public static async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('categories/create-category', {
        title: 'Create Category',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.addNewCategory') : 'Create Category',
        siteTitle,
        t,
        categories,
        category: null
      });
    } catch (error) {
      console.error('Error rendering create category page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Create category (POST)
   */
  public static async createCategoryPost(req: Request, res: Response): Promise<void> {
    try {
      let imageUrl = null;
      let videoUrl = null;

      const imageFile = categoryFileFromReq(req, 'image');
      const videoFile = categoryFileFromReq(req, 'video');

      if (imageFile) {
        imageUrl = getPublicUrl(imageFile.path);
        console.log('Category image uploaded:', {
          originalPath: imageFile.path,
          publicUrl: imageUrl,
          filename: imageFile.filename
        });
      }

      if (videoFile) {
        videoUrl = getPublicUrl(videoFile.path);
        console.log('Category video uploaded:', {
          originalPath: videoFile.path,
          publicUrl: videoUrl,
          filename: videoFile.filename
        });
      }

      const categoryData: any = {
        name: req.body.name,
        slug: req.body.slug,
        is_featured: req.body.is_featured === 'true' || req.body.is_featured === 'on',
        is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off'
      };

      if (req.body.description) categoryData.description = req.body.description;
      if (imageUrl) {
        categoryData.image_url = imageUrl;
        categoryData.thumb_url = (await generateThumbForPublicUrl(imageUrl)) ?? null;
      }
      if (videoUrl) categoryData.video_url = videoUrl;

      if (req.body.parent_id) {
        categoryData.parent_id = parseInt(req.body.parent_id);
      }

      await categoryService.createCategory(categoryData);
      await refreshStorefrontCategoryCaches();

      res.redirect(`/admin/categories?success=Category created successfully`);
    } catch (error: any) {
      console.error('Error creating category:', error);
      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      
      res.render('categories/create-category', {
        title: 'Create Category',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.addNewCategory') : 'Create Category',
        siteTitle,
        t,
        categories,
        category: null,
        error: error.message || 'Failed to create category'
      });
    }
  }

  /**
   * Edit category page (GET)
   */
  public static async editCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      const category = await categoryService.getCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).redirect('/admin/categories?error=Category not found');
      }

      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const productsResult = await productService.getAllProducts(page, 50, { category_id: categoryId });

      res.render('categories/edit-category', {
        title: 'Edit Category',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.editCategory') : 'Edit Category',
        siteTitle,
        t,
        categories,
        category,
        products: productsResult.products,
        pagination: {
          page: productsResult.page,
          limit: productsResult.limit,
          total: productsResult.total,
          totalPages: productsResult.totalPages
        }
      });
    } catch (error) {
      console.error('Error rendering edit category page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update category (POST)
   */
  public static async editCategoryPost(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      const categoryData: any = {};

      if (req.body.name) categoryData.name = req.body.name;
      if (req.body.slug) categoryData.slug = req.body.slug;
      if (req.body.description !== undefined) categoryData.description = req.body.description;
      if (req.body.is_featured !== undefined) categoryData.is_featured = req.body.is_featured === 'true' || req.body.is_featured === 'on';
      if (req.body.is_active !== undefined) categoryData.is_active = req.body.is_active === 'true' && req.body.is_active !== 'off';
      if (req.body.parent_id !== undefined) {
        categoryData.parent_id = req.body.parent_id ? parseInt(req.body.parent_id) : null;
      }

      // Handle image upload
      const imageFile = categoryFileFromReq(req, 'image');
      if (imageFile) {
        const existing = await categoryService.getCategoryById(categoryId);
        if (existing?.image_url) {
          deleteThumbFileForSourceImageUrl(existing.image_url);
        }
        categoryData.image_url = getPublicUrl(imageFile.path);
        categoryData.thumb_url = (await generateThumbForPublicUrl(categoryData.image_url)) ?? null;
        console.log('Category image updated:', {
          originalPath: imageFile.path,
          publicUrl: categoryData.image_url,
          filename: imageFile.filename
        });
      }

      const videoFile = categoryFileFromReq(req, 'video');
      if (videoFile) {
        const existing = await categoryService.getCategoryById(categoryId);
        if (existing?.video_url) {
          const normalizedPath = existing.video_url.replace(/^\/+/, '').replace(/\\/g, '/');
          const fullVideoPath = path.join(DATA_PATHS.PUBLIC_DIR, normalizedPath);
          storageService.deleteFile(fullVideoPath);
        }
        categoryData.video_url = getPublicUrl(videoFile.path);
        console.log('Category video updated:', {
          originalPath: videoFile.path,
          publicUrl: categoryData.video_url,
          filename: videoFile.filename
        });
      }

      await categoryService.updateCategory(categoryId, categoryData);
      await refreshStorefrontCategoryCaches();

      res.redirect(`/admin/categories?success=Category updated successfully`);
    } catch (error: any) {
      console.error('Error updating category:', error);
      const categoryId = parseInt(req.params.id);
      const category = await categoryService.getCategoryById(categoryId);
      const categories = await categoryService.getAllCategories(true);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      
      res.render('categories/edit-category', {
        title: 'Edit Category',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.editCategory') : 'Edit Category',
        siteTitle,
        t,
        categories,
        category,
        error: error.message || 'Failed to update category'
      });
    }
  }

  /**
   * Delete category
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      await categoryService.deleteCategory(categoryId);
      await refreshStorefrontCategoryCaches();

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: error.message || 'Failed to delete category' });
    }
  }

  /**
   * Delete category image
   */
  public static async deleteCategoryImage(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }
      
      console.log(`Attempting to delete image for category ID: ${categoryId}`);
      
      // Check if category exists
      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        console.log(`Category not found for ID: ${categoryId}`);
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }
      
      console.log(`Found category: ${existingCategory.name}, image_url: ${existingCategory.image_url}`);

      // Check if category has an image
      if (!existingCategory.image_url) {
        console.log('Category has no image to delete');
        res.status(400).json({
          success: false,
          message: 'Category has no image to delete'
        });
        return;
      }
      
      // Delete the image file if it exists
      const imagePath = existingCategory.image_url || '';
      if (imagePath) {
        deleteThumbFileForSourceImageUrl(imagePath);
        // Remove leading slash and normalize path
        const normalizedPath = imagePath.replace(/^\/+/, '').replace(/\\/g, '/');
        const fullImagePath = path.join(DATA_PATHS.PUBLIC_DIR, normalizedPath);
        console.log(`Deleting file at path: ${fullImagePath}`);
        storageService.deleteFile(fullImagePath);
      }
      
      // Update category to remove image reference
      const updateData: any = {
        image_url: null,
        thumb_url: null
      };
      
      console.log('Updating category to remove image reference');
      await categoryService.updateCategory(categoryId, updateData);
      await refreshStorefrontCategoryCaches();
      
      console.log('Category image deletion successful');
      res.json({
        success: true,
        message: 'Category image deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting category image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the category image'
      });
    }
  }

  /**
   * Delete category video
   */
  public static async deleteCategoryVideo(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      if (!existingCategory.video_url) {
        res.status(400).json({
          success: false,
          message: 'Category has no video to delete'
        });
        return;
      }

      const videoPath = existingCategory.video_url || '';
      if (videoPath) {
        const normalizedPath = videoPath.replace(/^\/+/, '').replace(/\\/g, '/');
        const fullVideoPath = path.join(DATA_PATHS.PUBLIC_DIR, normalizedPath);
        storageService.deleteFile(fullVideoPath);
      }

      await categoryService.updateCategory(categoryId, { video_url: null });
      await refreshStorefrontCategoryCaches();

      res.json({
        success: true,
        message: 'Category video deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting category video:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the category video'
      });
    }
  }
}

