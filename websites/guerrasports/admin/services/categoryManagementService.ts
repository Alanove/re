import { db } from '../../src/config/database';
import { Category } from '../../src/services/categoryService';

export interface CategoryCreateData {
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: number | null;
  image_url?: string | null;
  thumb_url?: string | null;
  is_featured?: boolean;
  order_index?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  is_active?: boolean;
}

export class CategoryManagementService {
  private static instance: CategoryManagementService;

  private constructor() {}

  public static getInstance(): CategoryManagementService {
    if (!CategoryManagementService.instance) {
      CategoryManagementService.instance = new CategoryManagementService();
    }
    return CategoryManagementService.instance;
  }

  /**
   * Create category
   */
  public async createCategory(data: CategoryCreateData): Promise<Category> {
    try {
      const [result] = await db.query<any>(
        `INSERT INTO product_categories (
          name, slug, description, parent_id, image_url, thumb_url, is_featured, order_index,
          meta_title, meta_description, meta_keywords, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.slug,
          data.description || null,
          data.parent_id || null,
          data.image_url || null,
          data.thumb_url || null,
          data.is_featured || false,
          data.order_index || 0,
          data.meta_title || null,
          data.meta_description || null,
          data.meta_keywords || null,
          data.is_active !== undefined ? data.is_active : true
        ]
      ) as any;

      const categoryId = (result as any).insertId;
      const category = await this.getCategoryById(categoryId);
      if (!category) {
        throw new Error('Failed to retrieve created category');
      }
      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update category
   */
  public async updateCategory(id: number, data: Partial<CategoryCreateData>): Promise<Category> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (updates.length === 0) {
        const category = await this.getCategoryById(id);
        if (!category) {
          throw new Error('Category not found');
        }
        return category;
      }

      values.push(id);
      await db.query(
        `UPDATE product_categories SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      const category = await this.getCategoryById(id);
      if (!category) {
        throw new Error('Category not found');
      }
      return category;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  public async deleteCategory(id: number): Promise<void> {
    try {
      // Check if category has children
      const [childrenRows] = await db.query<Array<{ id: number }>>(
        'SELECT id FROM product_categories WHERE parent_id = ?',
        [id]
      );

      if (childrenRows.length > 0) {
        throw new Error('Cannot delete category with subcategories');
      }

      // Check if category has products
      const [productRows] = await db.query<Array<{ id: number }>>(
        'SELECT id FROM products WHERE category_id = ? LIMIT 1',
        [id]
      );

      if (productRows.length > 0) {
        throw new Error('Cannot delete category with products');
      }

      await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  public async getCategoryById(id: number): Promise<Category | null> {
    try {
      const [rows] = await db.query<any[]>(
        'SELECT * FROM product_categories WHERE id = ?',
        [id]
      );
      if (rows.length > 0) {
        const row: any = rows[0];
        // Normalize image_url: convert backslashes to forward slashes and ensure it starts with /
        if (row.image_url) {
          row.image_url = row.image_url.replace(/\\/g, '/');
          if (!row.image_url.startsWith('/')) {
            row.image_url = '/' + row.image_url;
          }
          // Normalize multiple slashes
          row.image_url = row.image_url.replace(/\/+/g, '/');
        }
        return row as Category;
      }
      return null;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  public async getAllCategories(includeInactive: boolean = false): Promise<Category[]> {
    try {
      let query = `
        SELECT c.*, 
               pc.name as parent_name
        FROM product_categories c
        LEFT JOIN product_categories pc ON c.parent_id = pc.id
      `;
      const params: any[] = [];

      if (!includeInactive) {
        query += ' WHERE c.is_active = TRUE';
      }

      query += ' ORDER BY c.order_index ASC, c.name ASC';

      const [rows] = await db.query<any[]>(query, params);
      
      // Normalize image_url: convert backslashes to forward slashes and ensure it starts with /
      return rows.map((row: any) => {
        if (row.image_url) {
          row.image_url = row.image_url.replace(/\\/g, '/');
          if (!row.image_url.startsWith('/')) {
            row.image_url = '/' + row.image_url;
          }
          // Normalize multiple slashes
          row.image_url = row.image_url.replace(/\/+/g, '/');
        }
        return row;
      });
    } catch (error) {
      console.error('Error getting all categories:', error);
      throw error;
    }
  }

  /**
   * Update category order
   */
  public async updateCategoryOrder(updates: Array<{ id: number; order_index: number }>): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const update of updates) {
        await connection.query(
          'UPDATE product_categories SET order_index = ? WHERE id = ?',
          [update.order_index, update.id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error updating category order:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default CategoryManagementService.getInstance();

