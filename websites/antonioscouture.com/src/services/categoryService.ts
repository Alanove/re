import { db } from '../config/database';

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  image_url: string | null;
  thumb_url?: string | null;
  video_url?: string | null;
  is_featured: boolean;
  order_index: number;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
  product_count?: number;
}

export class CategoryService {
  private static instance: CategoryService;

  private constructor() {}

  public static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  /**
   * Get category by ID
   */
  public async getCategoryById(id: number): Promise<Category | null> {
    try {
      const [rows] = await db.query<Category[]>(
        'SELECT * FROM product_categories WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? (rows[0] as unknown as Category) : null;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  public async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const [rows] = await db.query<Category[]>(
        'SELECT * FROM product_categories WHERE slug = ?',
        [slug]
      );
      return rows.length > 0 ? (rows[0] as unknown as Category) : null;
    } catch (error) {
      console.error('Error getting category by slug:', error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  public async getAllCategories(includeInactive: boolean = false): Promise<Category[]> {
    try {
      let query = 'SELECT * FROM product_categories';
      const params: any[] = [];

      if (!includeInactive) {
        query += ' WHERE is_active = TRUE';
      }

      query += ' ORDER BY order_index ASC, name ASC';

      const [rows] = await db.query<Category[]>(query, params);
      return rows as unknown as Category[];
    } catch (error) {
      console.error('Error getting all categories:', error);
      throw error;
    }
  }

  /**
   * Get categories as hierarchical tree
   */
  public async getCategoryTree(includeInactive: boolean = false): Promise<CategoryWithChildren[]> {
    try {
      const allCategories = await this.getAllCategories(includeInactive);
      const categoryMap = new Map<number, CategoryWithChildren>();
      const rootCategories: CategoryWithChildren[] = [];

      // First pass: create map and add product counts
      for (const category of allCategories) {
        const categoryWithChildren: CategoryWithChildren = {
          ...category,
          children: []
        };

        // Get product count
      const [countRows] = await db.query<Array<{ count: number }>>(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = TRUE AND status = ?',
        [category.id, 'published']
      );
      categoryWithChildren.product_count = (countRows[0] as unknown as { count: number } | undefined)?.count || 0;

        categoryMap.set(category.id, categoryWithChildren);
      }

      // Second pass: build tree
      for (const category of allCategories) {
        const categoryWithChildren = categoryMap.get(category.id)!;
        if (category.parent_id === null) {
          rootCategories.push(categoryWithChildren);
        } else {
          const parent = categoryMap.get(category.parent_id);
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(categoryWithChildren);
          }
        }
      }

      return rootCategories as unknown as CategoryWithChildren[];
    } catch (error) {
      console.error('Error getting category tree:', error);
      throw error;
    }
  }

  /**
   * Get featured categories
   */
  public async getFeaturedCategories(limit: number = 10): Promise<Category[]> {
    try {
      const [rows] = await db.query<Category[]>(
        `SELECT * FROM product_categories WHERE is_featured = TRUE AND is_active = TRUE ORDER BY order_index ASC, name ASC LIMIT ?`,
        [limit]
      );
      return rows as unknown as Category[];
    } catch (error) {
      console.error('Error getting featured categories:', error);
      throw error;
    }
  }

  /**
   * Get category breadcrumbs
   */
  public async getCategoryBreadcrumbs(categoryId: number): Promise<Category[]> {
    try {
      const breadcrumbs: Category[] = [];
      let currentId: number | null = categoryId;

      while (currentId !== null) {
        const category = await this.getCategoryById(currentId);
        if (!category) break;

        breadcrumbs.unshift(category);
        currentId = category.parent_id;
      }

      return breadcrumbs;
    } catch (error) {
      console.error('Error getting category breadcrumbs:', error);
      throw error;
    }
  }

  /**
   * Get all descendant category IDs (including the category itself)
   */
  public async getCategoryDescendantIds(categoryId: number): Promise<number[]> {
    try {
      const descendantIds: number[] = [categoryId];

      const getChildren = async (parentId: number) => {
        const [rows] = await db.query<Array<{ id: number }>>(
          'SELECT id FROM product_categories WHERE parent_id = ?',
          [parentId]
        );

        for (const row of rows) {
        const rowId = (row as unknown as { id: number }).id;
        descendantIds.push(rowId);
        await getChildren(rowId);
        }
      };

      await getChildren(categoryId);
      return descendantIds;
    } catch (error) {
      console.error('Error getting category descendant IDs:', error);
      throw error;
    }
  }

  /**
   * Resolve hero video and poster for a category page.
   * Video walks up the parent chain when the category has none.
   * Poster uses the category image (then parent images if missing).
   */
  public async resolveCategoryHeroMedia(categoryId: number): Promise<{
    video_url: string | null;
    poster_image_url: string | null;
  }> {
    const breadcrumbs = await this.getCategoryBreadcrumbs(categoryId);
    if (breadcrumbs.length === 0) {
      return { video_url: null, poster_image_url: null };
    }

    let video_url: string | null = null;
    let poster_image_url: string | null = null;

    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      const video = breadcrumbs[i].video_url?.trim();
      if (!video_url && video) {
        video_url = video;
      }
      const image = breadcrumbs[i].image_url?.trim();
      if (!poster_image_url && image) {
        poster_image_url = image;
      }
      if (video_url && poster_image_url) break;
    }

    return { video_url, poster_image_url };
  }

  /**
   * Get category path (slug path)
   */
  public async getCategoryPath(categoryId: number): Promise<string> {
    try {
      const breadcrumbs = await this.getCategoryBreadcrumbs(categoryId);
      return breadcrumbs.map(c => c.slug).join('/');
    } catch (error) {
      console.error('Error getting category path:', error);
      throw error;
    }
  }
}

export default CategoryService.getInstance();

