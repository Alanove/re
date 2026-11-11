import { Request, Response } from 'express';
import { TransactionCategoriesService } from '../services/transactionCategoriesService';
import { SiteSettingsService } from '../services/siteSettingsService';

export class TransactionCategoriesController {
    private static categoriesService = TransactionCategoriesService.getInstance();
    private static siteSettingsService = SiteSettingsService.getInstance();

    static async categories(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionCategoriesController.siteSettingsService.getSiteTitle();
            const categories = await TransactionCategoriesController.categoriesService.getAllCategories();

            res.render('transaction-categories/list', {
                title: 'Transaction Categories',
                siteTitle,
                categories,
                currentPage: 'transaction-categories'
            });
        } catch (error) {
            console.error('Error fetching transaction categories:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading transaction categories',
                error: error 
            });
        }
    }

    static async createCategory(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionCategoriesController.siteSettingsService.getSiteTitle();
            res.render('transaction-categories/create', {
                title: 'Create Transaction Category',
                siteTitle,
                currentPage: 'transaction-categories'
            });
        } catch (error) {
            console.error('Error loading create category page:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading create category page',
                error: error 
            });
        }
    }

    static async createCategoryPost(req: Request, res: Response) {
        try {
            const { name, type, color, isActive } = req.body;

            if (!name || !type) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Name and type are required' 
                });
            }

            // Validate type
            if (!['income', 'expense', 'both'].includes(type)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid category type. Must be income, expense, or both' 
                });
            }

            const categoryData = {
                name: name.trim(),
                type: type,
                color: color || '#3498db',
                isActive: isActive === 'on' || isActive === true || isActive === 'true'
            };

            console.log('Creating category with data:', categoryData);

            const newCategory = await TransactionCategoriesController.categoriesService.createCategory(categoryData);

            console.log('Category created successfully:', newCategory);

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, category: newCategory });
            } else {
                res.redirect('/admin/transaction-categories');
            }
        } catch (error) {
            console.error('Error creating category:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error creating category: ' + (error instanceof Error ? error.message : 'Unknown error')
                });
            } else {
                res.status(500).render('admin/error', { 
                    message: 'Error creating category',
                    error: error 
                });
            }
        }
    }

    static async editCategory(req: Request, res: Response) {
        try {
            const siteTitle = await TransactionCategoriesController.siteSettingsService.getSiteTitle();
            const categoryId = parseInt(req.params.id);
            const category = await TransactionCategoriesController.categoriesService.getCategoryById(categoryId);
            
            if (!category) {
                return res.status(404).render('admin/error', { 
                    message: 'Category not found' 
                });
            }

            res.render('transaction-categories/edit', {
                title: 'Edit Transaction Category',
                siteTitle,
                category,
                currentPage: 'transaction-categories'
            });
        } catch (error) {
            console.error('Error loading edit category page:', error);
            res.status(500).render('admin/error', { 
                message: 'Error loading edit category page',
                error: error 
            });
        }
    }

    static async editCategoryPost(req: Request, res: Response) {
        try {
            const categoryId = parseInt(req.params.id);
            const { name, type, color, isActive } = req.body;

            if (!name || !type) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Name and type are required' 
                });
            }

            const updateData = {
                name: name.trim(),
                type: type,
                color: color || '#3498db',
                isActive: isActive === 'on' || isActive === true
            };

            const updatedCategory = await TransactionCategoriesController.categoriesService.updateCategory(categoryId, updateData);

            if (!updatedCategory) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Category not found' 
                });
            }

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, category: updatedCategory });
            } else {
                res.redirect('/admin/transaction-categories');
            }
        } catch (error) {
            console.error('Error updating category:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error updating category' 
                });
            } else {
                res.status(500).render('admin/error', { 
                    message: 'Error updating category',
                    error: error 
                });
            }
        }
    }

    static async deleteCategory(req: Request, res: Response) {
        try {
            const categoryId = parseInt(req.params.id);
            const success = await TransactionCategoriesController.categoriesService.deleteCategory(categoryId);

            if (!success) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Category not found' 
                });
            }

            res.json({ success: true, message: 'Category deleted successfully' });
        } catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error deleting category' 
            });
        }
    }

    static async getActiveCategories(req: Request, res: Response) {
        try {
            const categories = await TransactionCategoriesController.categoriesService.getActiveCategories();
            res.json(categories);
        } catch (error) {
            console.error('Error getting active categories:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error getting active categories' 
            });
        }
    }
}
