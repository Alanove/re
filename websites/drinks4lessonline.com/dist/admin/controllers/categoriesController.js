"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesController = void 0;
const path_1 = __importDefault(require("path"));
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const categoryManagementService_1 = require("../services/categoryManagementService");
const i18nService_1 = require("../services/i18nService");
const storageService_1 = require("../services/storageService");
const data_paths_1 = require("../../src/constants/data-paths");
const imageThumbService_1 = require("../../src/services/imageThumbService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const categoryService = categoryManagementService_1.CategoryManagementService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
class CategoriesController {
    static async index(req, res) {
        try {
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            categories.forEach((cat) => {
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
        }
        catch (error) {
            console.error('Error rendering categories page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async createCategory(req, res) {
        try {
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('categories/create-category', {
                title: 'Create Category',
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.addNewCategory') : 'Create Category',
                siteTitle,
                t,
                categories,
                category: null
            });
        }
        catch (error) {
            console.error('Error rendering create category page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async createCategoryPost(req, res) {
        try {
            let imageUrl = null;
            if (req.file) {
                imageUrl = (0, data_paths_1.getPublicUrl)(req.file.path);
                console.log('Category image uploaded:', {
                    originalPath: req.file.path,
                    publicUrl: imageUrl,
                    filename: req.file.filename
                });
            }
            const categoryData = {
                name: req.body.name,
                slug: req.body.slug,
                is_featured: req.body.is_featured === 'true' || req.body.is_featured === 'on',
                is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off'
            };
            if (req.body.description)
                categoryData.description = req.body.description;
            if (imageUrl) {
                categoryData.image_url = imageUrl;
                categoryData.thumb_url = (await (0, imageThumbService_1.generateThumbForPublicUrl)(imageUrl)) ?? null;
            }
            if (req.body.parent_id) {
                categoryData.parent_id = parseInt(req.body.parent_id);
            }
            const category = await categoryService.createCategory(categoryData);
            res.redirect(`/admin/categories?success=Category created successfully`);
        }
        catch (error) {
            console.error('Error creating category:', error);
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
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
    static async editCategory(req, res) {
        try {
            const categoryId = parseInt(req.params.id);
            const category = await categoryService.getCategoryById(categoryId);
            if (!category) {
                return res.status(404).redirect('/admin/categories?error=Category not found');
            }
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('categories/edit-category', {
                title: 'Edit Category',
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.categories.editCategory') : 'Edit Category',
                siteTitle,
                t,
                categories,
                category
            });
        }
        catch (error) {
            console.error('Error rendering edit category page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async editCategoryPost(req, res) {
        try {
            const categoryId = parseInt(req.params.id);
            const categoryData = {};
            if (req.body.name)
                categoryData.name = req.body.name;
            if (req.body.slug)
                categoryData.slug = req.body.slug;
            if (req.body.description !== undefined)
                categoryData.description = req.body.description;
            if (req.body.is_featured !== undefined)
                categoryData.is_featured = req.body.is_featured === 'true' || req.body.is_featured === 'on';
            if (req.body.is_active !== undefined)
                categoryData.is_active = req.body.is_active === 'true' && req.body.is_active !== 'off';
            if (req.body.parent_id !== undefined) {
                categoryData.parent_id = req.body.parent_id ? parseInt(req.body.parent_id) : null;
            }
            if (req.file) {
                const existing = await categoryService.getCategoryById(categoryId);
                if (existing?.image_url) {
                    (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(existing.image_url);
                }
                categoryData.image_url = (0, data_paths_1.getPublicUrl)(req.file.path);
                categoryData.thumb_url = (await (0, imageThumbService_1.generateThumbForPublicUrl)(categoryData.image_url)) ?? null;
                console.log('Category image updated:', {
                    originalPath: req.file.path,
                    publicUrl: categoryData.image_url,
                    filename: req.file.filename
                });
            }
            await categoryService.updateCategory(categoryId, categoryData);
            res.redirect(`/admin/categories?success=Category updated successfully`);
        }
        catch (error) {
            console.error('Error updating category:', error);
            const categoryId = parseInt(req.params.id);
            const category = await categoryService.getCategoryById(categoryId);
            const categories = await categoryService.getAllCategories(true);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
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
    static async delete(req, res) {
        try {
            const categoryId = parseInt(req.params.id);
            await categoryService.deleteCategory(categoryId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({ error: error.message || 'Failed to delete category' });
        }
    }
    static async deleteCategoryImage(req, res) {
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
            if (!existingCategory.image_url) {
                console.log('Category has no image to delete');
                res.status(400).json({
                    success: false,
                    message: 'Category has no image to delete'
                });
                return;
            }
            const imagePath = existingCategory.image_url || '';
            if (imagePath) {
                (0, imageThumbService_1.deleteThumbFileForSourceImageUrl)(imagePath);
                const normalizedPath = imagePath.replace(/^\/+/, '').replace(/\\/g, '/');
                const fullImagePath = path_1.default.join(data_paths_1.DATA_PATHS.PUBLIC_DIR, normalizedPath);
                console.log(`Deleting file at path: ${fullImagePath}`);
                storageService.deleteFile(fullImagePath);
            }
            const updateData = {
                image_url: null,
                thumb_url: null
            };
            console.log('Updating category to remove image reference');
            await categoryService.updateCategory(categoryId, updateData);
            console.log('Category image deletion successful');
            res.json({
                success: true,
                message: 'Category image deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting category image:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the category image'
            });
        }
    }
}
exports.CategoriesController = CategoriesController;
//# sourceMappingURL=categoriesController.js.map