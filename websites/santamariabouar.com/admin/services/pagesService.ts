import { db } from '../../src/config/database';
import { sanitizeCmsHtml } from '../../src/utils/htmlSanitizer';

export interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  backgroundImage?: string | null;
  seoImage?: string | null;
  metaDescription?: string;
  metaKeywords?: string;
  status: string;
  template?: string;
  parentId?: number | null;
  orderIndex: number;
  createdAt: string;
  updatedAt?: string;
}

const PAGE_SELECT = `
  id, title, slug, content,
  background_image as backgroundImage,
  seo_image as seoImage,
  meta_description as metaDescription,
  meta_keywords as metaKeywords,
  status, template, parent_id as parentId,
  order_index as orderIndex,
  DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
  DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
`;

export class PagesService {
  private static instance: PagesService;

  private constructor() {}

  public static getInstance(): PagesService {
    if (!PagesService.instance) {
      PagesService.instance = new PagesService();
    }
    return PagesService.instance;
  }

  async getAllPages(): Promise<any[]> {
    try {
      // First check if pages table exists
      const [tables] = await db.query("SHOW TABLES LIKE 'pages'");
      
      if (tables.length === 0) {
        return [];
      }
      
      const [rows] = await db.query(`
        SELECT ${PAGE_SELECT}
        FROM pages
        ORDER BY order_index, title
      `);
      
      // Transform data to match view template expectations
      const transformedPages = (rows as any[]).map(page => ({
        ...page,
        key: page.slug, // Map slug to key for view compatibility
        url: `/${page.slug}`, // Generate URL from slug
        lastUpdated: page.updatedAt || page.createdAt,
        backgroundImage: page.backgroundImage || null,
        seo: {
          pageTitle: page.title,
          pageDescription: page.metaDescription || '',
          pageKeywords: page.metaKeywords || '',
          pageImage: page.seoImage || page.backgroundImage || ''
        }
      }));
      
      return transformedPages;
    } catch (error) {
      console.error('Error fetching pages:', error);
      return [];
    }
  }

  async getPageById(id: number): Promise<Page | null> {
    try {
      const [rows] = await db.query(`
        SELECT ${PAGE_SELECT}
        FROM pages
        WHERE id = ?
      `, [id]);
      
      const results = rows as any[];
      return results[0] || null;
    } catch (error) {
      console.error('Error fetching page by ID:', error);
      return null;
    }
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    try {
      const [rows] = await db.query(`
        SELECT ${PAGE_SELECT}
        FROM pages
        WHERE slug = ?
      `, [slug]);
      
      const results = rows as any[];
      return results[0] || null;
    } catch (error) {
      console.error('Error fetching page by slug:', error);
      return null;
    }
  }

  async getPageByKey(key: string): Promise<Page | null> {
    try {
      // First try to find by slug
      const pageBySlug = await this.getPageBySlug(key);
      if (pageBySlug) {
        return pageBySlug;
      }
      
      // If not found by slug, try to find by ID (if key is numeric)
      const numericKey = parseInt(key);
      if (!isNaN(numericKey)) {
        return await this.getPageById(numericKey);
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching page by key:', error);
      return null;
    }
  }

  async createPage(pageData: Omit<Page, 'id' | 'createdAt' | 'updatedAt'>): Promise<Page> {
    try {
      const [result] = await db.query(`
        INSERT INTO pages (title, slug, content, background_image, seo_image, meta_description, meta_keywords, status, template, parent_id, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pageData.title,
        pageData.slug,
        sanitizeCmsHtml(pageData.content || ''),
        pageData.backgroundImage || null,
        pageData.seoImage || null,
        pageData.metaDescription || '',
        pageData.metaKeywords || '',
        pageData.status || 'draft',
        pageData.template || '',
        pageData.parentId || null,
        pageData.orderIndex || 0
      ]);
      
      const insertId = (result as any).insertId;
      const newPage = await this.getPageById(insertId);
      if (!newPage) throw new Error('Failed to retrieve created page');
      return newPage;
    } catch (error) {
      console.error('Error creating page:', error);
      throw new Error('Failed to create page');
    }
  }

  async updatePage(id: number, updates: Partial<Omit<Page, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Page | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.slug !== undefined) {
        updateFields.push('slug = ?');
        values.push(updates.slug);
      }
      if (updates.content !== undefined) {
        updateFields.push('content = ?');
        values.push(sanitizeCmsHtml(updates.content || ''));
      }
      if (updates.backgroundImage !== undefined) {
        updateFields.push('background_image = ?');
        values.push(updates.backgroundImage || null);
      }
      if (updates.seoImage !== undefined) {
        updateFields.push('seo_image = ?');
        values.push(updates.seoImage || null);
      }
      if (updates.metaDescription !== undefined) {
        updateFields.push('meta_description = ?');
        values.push(updates.metaDescription);
      }
      if (updates.metaKeywords !== undefined) {
        updateFields.push('meta_keywords = ?');
        values.push(updates.metaKeywords);
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.template !== undefined) {
        updateFields.push('template = ?');
        values.push(updates.template);
      }
      if (updates.parentId !== undefined) {
        updateFields.push('parent_id = ?');
        values.push(updates.parentId);
      }
      if (updates.orderIndex !== undefined) {
        updateFields.push('order_index = ?');
        values.push(updates.orderIndex);
      }

      if (updateFields.length === 0) {
        return await this.getPageById(id);
      }

      values.push(id);
      await db.query(`
        UPDATE pages
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getPageById(id);
    } catch (error) {
      console.error('Error updating page:', error);
      return null;
    }
  }

  async deletePage(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM pages WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting page:', error);
      return false;
    }
  }

  async getPublishedPages(): Promise<Page[]> {
    try {
      const [rows] = await db.query(`
        SELECT ${PAGE_SELECT}
        FROM pages
        WHERE status = 'published'
        ORDER BY order_index, title
      `);
      return rows as Page[];
    } catch (error) {
      console.error('Error fetching published pages:', error);
      return [];
    }
  }
}

export const pagesService = PagesService.getInstance();
