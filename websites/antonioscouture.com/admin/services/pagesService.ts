import { db } from '../../src/config/database';
import { generateThumbForPublicUrl, resolveListingThumbUrl } from '../../src/services/imageThumbService';

export interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  description?: string;
  metaDescription?: string;
  metaKeywords?: string;
  status: string;
  template?: string;
  parentId?: number | null;
  orderIndex: number;
  createdAt: string;
  updatedAt?: string;
  pageImage?: string;
  /** DB path to WebP thumb for listings (events carousel, etc.) */
  pageImageThumb?: string;
  seoImage?: string;
  publishDate?: string | null;
  tags?: PageTag[];
}

export interface PageTag {
  id: number;
  name: string;
  slug: string;
}

export class PagesService {
  private static instance: PagesService;

  /** Cached pages columns + tag tables (avoid failing SELECTs on older DBs). */
  private pagesSchemaCache: { columns: Set<string>; tagTablesOk: boolean } | null = null;

  private constructor() {}

  private async getPagesSchema(): Promise<{ columns: Set<string>; tagTablesOk: boolean }> {
    if (this.pagesSchemaCache) {
      return this.pagesSchemaCache;
    }
    const [pageCols] = (await db.query(`
      SELECT COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages'
    `)) as any[];

    const columns = new Set<string>();
    for (const row of pageCols || []) {
      const n = String(row.column_name || row.COLUMN_NAME || '').toLowerCase();
      if (n) columns.add(n);
    }

    const [pt] = await db.query("SHOW TABLES LIKE 'page_tags'");
    const [ptr] = await db.query("SHOW TABLES LIKE 'page_tag_relationships'");
    const tagTablesOk =
      Array.isArray(pt) && pt.length > 0 && Array.isArray(ptr) && ptr.length > 0;

    this.pagesSchemaCache = { columns, tagTablesOk };
    return this.pagesSchemaCache;
  }

  /** Column list matching Page shape; optional table alias (e.g. p → p.id). */
  private async selectPagesFields(alias?: string): Promise<string> {
    const { columns: c } = await this.getPagesSchema();
    const p = alias ? `${alias}.` : '';

    const parts: string[] = [
      `${p}id`,
      `${p}title`,
      `${p}slug`,
      `${p}content`,
      c.has('description') ? `${p}description` : `CAST(NULL AS CHAR) AS description`,
      `${p}meta_description as metaDescription`,
      `${p}meta_keywords as metaKeywords`,
      `${p}status`,
      `${p}template`,
      `${p}parent_id as parentId`,
      `${p}order_index as orderIndex`,
      c.has('page_image')
        ? `COALESCE(${p}page_image, '') as pageImage`
        : `'' as pageImage`,
      c.has('page_image_thumb')
        ? `COALESCE(${p}page_image_thumb, '') as pageImageThumb`
        : `'' as pageImageThumb`,
      c.has('seo_image')
        ? `COALESCE(${p}seo_image, '') as seoImage`
        : `'' as seoImage`,
      c.has('publish_date')
        ? `DATE_FORMAT(${p}publish_date, '%Y-%m-%d') as publishDate`
        : `CAST(NULL AS DATE) as publishDate`,
      `DATE_FORMAT(${p}created_at, '%Y-%m-%dT%TZ') as createdAt`,
      `DATE_FORMAT(${p}updated_at, '%Y-%m-%dT%TZ') as updatedAt`,
    ];
    return parts.join(',\n          ');
  }

  private async pagesOrderByWithPublishDate(alias: string): Promise<string> {
    const { columns: c } = await this.getPagesSchema();
    const p = alias;
    if (c.has('publish_date')) {
      return ` ORDER BY ISNULL(${p}.publish_date), ${p}.publish_date DESC, ${p}.created_at DESC, ${p}.title ASC`;
    }
    return ` ORDER BY ${p}.created_at DESC, ${p}.title ASC`;
  }

  public static getInstance(): PagesService {
    if (!PagesService.instance) {
      PagesService.instance = new PagesService();
    }
    return PagesService.instance;
  }

  async getAllPages(): Promise<any[]> {
    try {
      console.log('Debug - Attempting to fetch pages from database...');
      
      // First check if pages table exists
      const [tables] = await db.query("SHOW TABLES LIKE 'pages'");
      console.log('Debug - Pages table exists:', tables.length > 0);
      
      if (tables.length === 0) {
        console.log('Debug - Pages table does not exist, returning empty array');
        return [];
      }

      const fields = await this.selectPagesFields('p');
      const [rows] = await db.query(`
        SELECT 
          ${fields}
        FROM pages p
        ORDER BY p.order_index, p.title
      `);
      
      console.log('Debug - Raw database rows:', rows);
      
        // Transform data to match view template expectations
      const transformedPages = await Promise.all((rows as any[]).map(async (page) => {
        // Load tags for each page
        const tags = await this.getPageTags(page.id);
        return {
          ...page,
          key: page.slug, // Map slug to key for view compatibility
          url: `/${page.slug}`, // Generate URL from slug
          lastUpdated: page.updatedAt || page.createdAt,
          pageImage: page.pageImage || null,
          seoImage: page.seoImage || null,
          tags: tags,
          seo: {
            pageTitle: page.metaDescription || page.title
          }
        };
      }));
      
      console.log('Debug - Transformed pages:', transformedPages);
      return transformedPages;
    } catch (error) {
      console.error('Error fetching pages:', error);
      return [];
    }
  }

  async getPageById(id: number): Promise<Page | null> {
    try {
      const fields = await this.selectPagesFields('p');
      const [rows] = await db.query(`
        SELECT 
          ${fields}
        FROM pages p
        WHERE p.id = ?
      `, [id]);
      
      const results = rows as any[];
      const page = results[0] || null;
      
      if (page) {
        page.tags = await this.getPageTags(id);
      }
      
      return page;
    } catch (error) {
      console.error('Error fetching page by ID:', error);
      return null;
    }
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    try {
      const fields = await this.selectPagesFields('p');
      const [rows] = await db.query(`
        SELECT 
          ${fields}
        FROM pages p
        WHERE p.slug = ?
      `, [slug]);
      
      const results = rows as any[];
      const page = results[0] || null;
      
      if (page) {
        page.tags = await this.getPageTags(page.id);
      }
      
      return page;
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
      // Check which columns exist in the pages table
      const [allColumns] = await db.query(`
        SELECT COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE, EXTRA, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pages'
        ORDER BY ORDINAL_POSITION
      `) as any[];
      
      const existingColumns = new Set<string>();
      const columnMetadata: Map<string, any> = new Map();
      if (Array.isArray(allColumns)) {
        allColumns.forEach((col: any) => {
          // Handle different possible formats of column name
          const colName = (col.COLUMN_NAME || col.column_name || col.Column_Name || '').toLowerCase();
          if (colName) {
            existingColumns.add(colName);
            columnMetadata.set(colName, {
              name: colName,
              default: col.COLUMN_DEFAULT || col.column_default,
              nullable: col.IS_NULLABLE || col.is_nullable,
              extra: (col.EXTRA || col.extra || '').toLowerCase(),
              type: col.COLUMN_TYPE || col.column_type
            });
          }
        });
      }
      
      console.log('DEBUG createPage allColumns result:', JSON.stringify(allColumns, null, 2));
      console.log('DEBUG createPage existing columns:', Array.from(existingColumns).sort());
      
      console.log('DEBUG createPage column metadata:', Array.from(columnMetadata.entries()).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', '));
      
      // Build INSERT statement dynamically based on existing columns
      const columns: string[] = ['title', 'slug', 'content'];
      const values: any[] = [pageData.title, pageData.slug, pageData.content];
      const placeholders: string[] = ['?', '?', '?'];
      
      // Add optional columns if they exist (using lowercase for comparison)
      if (existingColumns.has('description')) {
        columns.push('description');
        values.push(pageData.description || null);
        placeholders.push('?');
      }
      
      if (existingColumns.has('meta_description')) {
        columns.push('meta_description');
        values.push(pageData.metaDescription || '');
        placeholders.push('?');
      }
      
      if (existingColumns.has('meta_keywords')) {
        columns.push('meta_keywords');
        values.push(pageData.metaKeywords || '');
        placeholders.push('?');
      }
      
      if (existingColumns.has('status')) {
        columns.push('status');
        values.push(pageData.status || 'draft');
        placeholders.push('?');
      }
      
      if (existingColumns.has('template')) {
        columns.push('template');
        values.push(pageData.template || '');
        placeholders.push('?');
      }
      
      if (existingColumns.has('parent_id')) {
        columns.push('parent_id');
        values.push(pageData.parentId || null);
        placeholders.push('?');
      }
      
      if (existingColumns.has('order_index')) {
        columns.push('order_index');
        values.push(pageData.orderIndex || 0);
        placeholders.push('?');
      }
      
      if (existingColumns.has('page_image')) {
        columns.push('page_image');
        values.push(pageData.pageImage || null);
        placeholders.push('?');
      }
      
      if (existingColumns.has('seo_image')) {
        columns.push('seo_image');
        values.push(pageData.seoImage || null);
        placeholders.push('?');
      }
      
      if (existingColumns.has('publish_date')) {
        columns.push('publish_date');
        values.push(pageData.publishDate || null);
        placeholders.push('?');
      }
      
      // Execute INSERT with dynamically built columns
      const sql = `INSERT INTO pages (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      console.log('DEBUG createPage SQL:', sql);
      console.log('DEBUG createPage columns:', columns);
      console.log('DEBUG createPage columns count:', columns.length);
      console.log('DEBUG createPage values:', values);
      console.log('DEBUG createPage values count:', values.length);
      console.log('DEBUG createPage placeholders count:', placeholders.length);
      
      // Verify counts match
      if (columns.length !== values.length || columns.length !== placeholders.length) {
        throw new Error(`Column/Value count mismatch: columns=${columns.length}, values=${values.length}, placeholders=${placeholders.length}`);
      }
      
      const [result] = await db.query(sql, values);
      
      const insertId = (result as any).insertId;
      if (pageData.pageImage && String(pageData.pageImage).trim()) {
        await this.refreshPageImageThumb(insertId);
      }
      const newPage = await this.getPageById(insertId);
      if (!newPage) throw new Error('Failed to retrieve created page');
      
      // Handle tags if provided
      if (pageData.tags && pageData.tags.length > 0) {
        const tagNames = pageData.tags.map(tag => typeof tag === 'string' ? tag : tag.name);
        await this.setPageTags(insertId, tagNames);
        // Reload page to get tags
        return await this.getPageById(insertId) || newPage;
      }
      
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
        values.push(updates.content);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description && typeof updates.description === 'string' && updates.description.trim() !== '' ? updates.description.trim() : null);
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
      if (updates.pageImage !== undefined) {
        updateFields.push('page_image = ?');
        values.push(updates.pageImage && typeof updates.pageImage === 'string' && updates.pageImage.trim() !== '' ? updates.pageImage : null);
      }
      if (updates.seoImage !== undefined) {
        updateFields.push('seo_image = ?');
        values.push(updates.seoImage && typeof updates.seoImage === 'string' && updates.seoImage.trim() !== '' ? updates.seoImage : null);
      }
      if (updates.publishDate !== undefined) {
        updateFields.push('publish_date = ?');
        values.push(updates.publishDate || null);
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

      if (updates.pageImage !== undefined) {
        await this.refreshPageImageThumb(id);
      }
      
      return await this.getPageById(id);
    } catch (error) {
      console.error('Error updating page:', error);
      return null;
    }
  }

  async deletePage(id: number): Promise<boolean> {
    try {
      // Start transaction
      await db.query('START TRANSACTION');

      try {
        // 1. Delete page tag relationships
        await db.query(`
          DELETE FROM page_tag_relationships WHERE page_id = ?
        `, [id]);

        // 2. Delete page photos (file deletion is handled by controller/storage service, this deletes DB records)
        await db.query(`
          DELETE FROM page_photos WHERE page_id = ?
        `, [id]);

        // 3. Update child pages to remove parent reference (prevent foreign key constraint failure)
        await db.query(`
          UPDATE pages SET parent_id = NULL WHERE parent_id = ?
        `, [id]);

        // 4. Delete the page
        const [result] = await db.query(`
          DELETE FROM pages WHERE id = ?
        `, [id]);

        await db.query('COMMIT');
        
        return (result as any).affectedRows > 0;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      return false;
    }
  }

  async getPublishedPages(): Promise<Page[]> {
    try {
      const fields = await this.selectPagesFields('p');
      const [rows] = await db.query(`
        SELECT 
          ${fields}
        FROM pages p
        WHERE p.status = 'published'
        ORDER BY p.order_index, p.title
      `);
      return rows as Page[];
    } catch (error) {
      console.error('Error fetching published pages:', error);
      return [];
    }
  }

  /**
   * Generate WebP thumb for pages.page_image and persist pages.page_image_thumb (listings).
   */
  async refreshPageImageThumb(pageId: number): Promise<void> {
    try {
      const [cols] = await db.query<any[]>(`SHOW COLUMNS FROM pages WHERE Field = ?`, ['page_image_thumb']);
      if (!cols || cols.length === 0) return;

      const page = await this.getPageById(pageId);
      if (!page?.pageImage || !String(page.pageImage).trim()) {
        await db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
        return;
      }
      const url = String(page.pageImage).trim();
      if (/^https?:\/\//i.test(url)) {
        await db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
        return;
      }
      const thumb = await generateThumbForPublicUrl(url);
      if (thumb) {
        await db.query(`UPDATE pages SET page_image_thumb = ? WHERE id = ?`, [thumb, pageId]);
      } else {
        await db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
      }
    } catch (e) {
      console.error('refreshPageImageThumb failed', pageId, e);
    }
  }

  // Page Photos methods
  async getPagePhotos(pageId: number): Promise<any[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, page_id as pageId, filename, file_path as filePath,
          thumb_url as thumbUrl,
          display_order as displayOrder,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM page_photos
        WHERE page_id = ?
        ORDER BY display_order ASC, id ASC
      `, [pageId]);
      
      const photos = rows as any[];
      
      // Get the page to convert old page key paths to slug-based paths
      const page = await this.getPageById(pageId);
      if (page && page.slug) {
        // Convert file paths from old page key format to slug format
        return photos.map(photo => {
          if (photo.filePath) {
            // Replace old page key pattern with slug in the path
            // Pattern: /pages/{oldKey}/gallery/... -> /pages/{slug}/gallery/...
            const updatedPath = photo.filePath.replace(/\/pages\/[^\/]+\/gallery\//, `/pages/${page.slug}/gallery/`);
            const thumbSrc =
              resolveListingThumbUrl(updatedPath, photo.thumbUrl ?? null) || updatedPath;
            return {
              ...photo,
              filePath: updatedPath,
              thumbSrc
            };
          }
          const thumbSrc =
            resolveListingThumbUrl(photo.filePath, photo.thumbUrl ?? null) || photo.filePath;
          return { ...photo, thumbSrc };
        });
      }
      
      return photos.map(p => ({
        ...p,
        thumbSrc: resolveListingThumbUrl(p.filePath, p.thumbUrl ?? null) || p.filePath
      }));
    } catch (error) {
      console.error('Error fetching page photos:', error);
      return [];
    }
  }

  async addPagePhoto(pageId: number, filename: string, filePath: string): Promise<any> {
    try {
      // Get the maximum display_order for this page
      const [maxOrderResult] = await db.query(`
        SELECT COALESCE(MAX(display_order), 0) as maxOrder
        FROM page_photos
        WHERE page_id = ?
      `, [pageId]);
      
      const maxOrder = (maxOrderResult as any[])[0]?.maxOrder || 0;
      const displayOrder = maxOrder + 1;

      const [result] = await db.query(`
        INSERT INTO page_photos (page_id, filename, file_path, display_order)
        VALUES (?, ?, ?, ?)
      `, [pageId, filename, filePath, displayOrder]);

      const insertId = (result as any).insertId;
      const thumb = await generateThumbForPublicUrl(filePath);
      if (thumb) {
        await db.query(`UPDATE page_photos SET thumb_url = ? WHERE id = ?`, [thumb, insertId]);
      }

      const [rows] = await db.query(`
        SELECT 
          id, page_id as pageId, filename, file_path as filePath,
          thumb_url as thumbUrl,
          display_order as displayOrder,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM page_photos
        WHERE id = ?
      `, [insertId]);

      const row = (rows as any[])[0];
      if (!row) return null;
      return {
        ...row,
        thumbSrc: resolveListingThumbUrl(row.filePath, row.thumbUrl ?? null) || row.filePath
      };
    } catch (error) {
      console.error('Error adding page photo:', error);
      throw error;
    }
  }

  async deletePagePhoto(photoId: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM page_photos WHERE id = ?
      `, [photoId]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting page photo:', error);
      return false;
    }
  }

  async reorderPagePhotos(pageId: number, photoOrders: { id: number; order: number }[]): Promise<boolean> {
    try {
      // Use transaction for multiple updates
      await db.query('START TRANSACTION');
      
      try {
        for (const { id, order } of photoOrders) {
          await db.query(`
            UPDATE page_photos
            SET display_order = ?
            WHERE id = ? AND page_id = ?
          `, [order, id, pageId]);
        }
        
        await db.query('COMMIT');
        return true;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error reordering page photos:', error);
      return false;
    }
  }

  // Page Tags methods
  async getPageTags(pageId: number): Promise<PageTag[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          pt.id, pt.name, pt.slug
        FROM page_tags pt
        INNER JOIN page_tag_relationships ptr ON pt.id = ptr.tag_id
        WHERE ptr.page_id = ?
        ORDER BY pt.name ASC
      `, [pageId]);
      return rows as PageTag[];
    } catch (error) {
      console.error('Error fetching page tags:', error);
      return [];
    }
  }

  async getAllTags(): Promise<PageTag[]> {
    try {
      const [rows] = await db.query(`
        SELECT id, name, slug
        FROM page_tags
        ORDER BY name ASC
      `);
      return rows as PageTag[];
    } catch (error) {
      console.error('Error fetching all tags:', error);
      return [];
    }
  }

  async getTopTags(limit: number = 10): Promise<PageTag[]> {
    try {
      const [rows] = await db.query(`
        SELECT pt.id, pt.name, pt.slug
        FROM page_tags pt
        LEFT JOIN page_tag_relationships ptr ON pt.id = ptr.tag_id
        GROUP BY pt.id, pt.name, pt.slug
        ORDER BY COUNT(ptr.page_id) DESC, pt.name ASC
        LIMIT ?
      `, [limit]);
      return rows as PageTag[];
    } catch (error) {
      console.error('Error fetching top tags:', error);
      return [];
    }
  }

  async getPagesWithPagination(options: {
    page?: number;
    itemsPerPage?: number;
    keyword?: string;
    status?: string;
    tag?: string;
    year?: number;
    month?: number;
    day?: number;
  }): Promise<{ pages: any[]; total: number }> {
    try {
      const schema = await this.getPagesSchema();
      const page = options.page || 1;
      const itemsPerPage = options.itemsPerPage || 20;
      const offset = (page - 1) * itemsPerPage;

      // Build WHERE conditions
      const whereConditions: string[] = [];
      const params: any[] = [];

      let effectiveTag = (options.tag || '').trim();
      if (!schema.tagTablesOk) {
        effectiveTag = '';
      }

      const hasTagFilter = !!effectiveTag;
      const isNoTagFilter = effectiveTag === '__no_tag__';

      // Handle keyword filter
      if (options.keyword) {
        whereConditions.push('(p.title LIKE ? OR p.slug LIKE ? OR p.content LIKE ?)');
        const keywordPattern = `%${options.keyword}%`;
        params.push(keywordPattern, keywordPattern, keywordPattern);
      }

      // Handle status filter
      if (options.status) {
        whereConditions.push('p.status = ?');
        params.push(options.status);
      }

      // Handle tag filter - filter by slug for more reliable matching
      if (hasTagFilter && !isNoTagFilter) {
        whereConditions.push('pt.slug = ?');
        params.push(effectiveTag);
      }
      
      // Handle "no tag" filter - pages with no tags
      if (isNoTagFilter) {
        whereConditions.push('ptr.page_id IS NULL');
      }

      // Handle date filters
      if (schema.columns.has('publish_date') && options.year !== undefined) {
        if (options.month !== undefined) {
          if (options.day !== undefined) {
            // Filter by specific day
            whereConditions.push('YEAR(p.publish_date) = ? AND MONTH(p.publish_date) = ? AND DAY(p.publish_date) = ?');
            params.push(options.year, options.month, options.day);
          } else {
            // Filter by month
            whereConditions.push('YEAR(p.publish_date) = ? AND MONTH(p.publish_date) = ?');
            params.push(options.year, options.month);
          }
        } else {
          // Filter by year
          whereConditions.push('YEAR(p.publish_date) = ?');
          params.push(options.year);
        }
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Build count query
      let countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM pages p
      `;

      if (hasTagFilter && !isNoTagFilter) {
        countQuery += `
          INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
          INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        `;
      } else if (isNoTagFilter) {
        countQuery += `
          LEFT JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        `;
      }

      countQuery += ' ' + whereClause;

      const [countResult] = await db.query(countQuery, params);
      const total = (countResult as any[])[0]?.total || 0;

      const selectFields = await this.selectPagesFields('p');

      // Build main query
      let mainQuery = `
        SELECT 
          ${selectFields}
        FROM pages p
      `;

      if (hasTagFilter && !isNoTagFilter) {
        mainQuery += `
          INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
          INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        `;
      } else if (isNoTagFilter) {
        mainQuery += `
          LEFT JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        `;
      }

      mainQuery += ' ' + whereClause;
      const orderClause = await this.pagesOrderByWithPublishDate('p');
      mainQuery += isNoTagFilter ? `${orderClause} LIMIT ? OFFSET ?` : ` GROUP BY p.id ${orderClause} LIMIT ? OFFSET ?`;
      
      const queryParams = [...params, itemsPerPage, offset];
      const [rows] = await db.query(mainQuery, queryParams);

      // Transform data
      const transformedPages = await Promise.all((rows as any[]).map(async (page) => {
        const tags = await this.getPageTags(page.id);
        return {
          ...page,
          key: page.slug,
          url: `/${page.slug}`,
          lastUpdated: page.updatedAt || page.createdAt,
          pageImage: page.pageImage || null,
          seoImage: page.seoImage || null,
          tags: tags,
          seo: {
            pageTitle: page.metaDescription || page.title
          }
        };
      }));

      return {
        pages: transformedPages,
        total: total
      };
    } catch (error) {
      console.error('Error fetching pages with pagination:', error);
      return {
        pages: [],
        total: 0
      };
    }
  }

  /**
   * Search pages by keyword for autocomplete
   * Returns a lightweight list of pages matching the search term
   * Also supports exact slug/key matching for better results when editing
   */
  async searchPages(keyword: string, limit: number = 20): Promise<any[]> {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return [];
      }

      const trimmedKeyword = keyword.trim();
      const searchTerm = `%${trimmedKeyword}%`;
      
      // First check for exact slug match
      const exactSlugMatch = await this.getPageBySlug(trimmedKeyword);
      const exactMatches: any[] = [];
      
      if (exactSlugMatch) {
        exactMatches.push({
          id: exactSlugMatch.id,
          title: exactSlugMatch.title,
          key: exactSlugMatch.slug,
          slug: exactSlugMatch.slug
        });
      }
      
      // Then get other matches
      const [rows] = await db.query(`
        SELECT 
          id, title, slug
        FROM pages
        WHERE (title LIKE ? OR slug LIKE ?)
          AND slug != ?
        ORDER BY 
          CASE 
            WHEN title LIKE ? THEN 1
            WHEN slug LIKE ? THEN 2
            ELSE 3
          END,
          title ASC
        LIMIT ?
      `, [searchTerm, searchTerm, trimmedKeyword, searchTerm, searchTerm, limit - exactMatches.length]);

      const otherMatches = (rows as any[]).map(page => ({
        id: page.id,
        title: page.title,
        key: page.slug,
        slug: page.slug
      }));

      // Combine exact matches first, then other matches
      return [...exactMatches, ...otherMatches];
    } catch (error) {
      console.error('Error searching pages:', error);
      return [];
    }
  }

  async findOrCreateTag(tagName: string): Promise<PageTag> {
    try {
      // Generate slug from tag name
      const slug = tagName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Try to find existing tag
      const [existingRows] = await db.query(`
        SELECT id, name, slug
        FROM page_tags
        WHERE slug = ? OR name = ?
        LIMIT 1
      `, [slug, tagName.trim()]);

      if (Array.isArray(existingRows) && existingRows.length > 0) {
        return existingRows[0] as PageTag;
      }

      // Create new tag
      const [result] = await db.query(`
        INSERT INTO page_tags (name, slug)
        VALUES (?, ?)
      `, [tagName.trim(), slug]);

      const insertId = (result as any).insertId;
      const [rows] = await db.query(`
        SELECT id, name, slug
        FROM page_tags
        WHERE id = ?
      `, [insertId]);

      return (rows as any[])[0] as PageTag;
    } catch (error) {
      console.error('Error finding or creating tag:', error);
      throw error;
    }
  }

  async setPageTags(pageId: number, tagNames: string[]): Promise<boolean> {
    try {
      await db.query('START TRANSACTION');
      
      try {
        // Delete existing relationships
        await db.query(`
          DELETE FROM page_tag_relationships
          WHERE page_id = ?
        `, [pageId]);

        // Create new relationships
        for (const tagName of tagNames) {
          if (tagName && tagName.trim()) {
            const tag = await this.findOrCreateTag(tagName.trim());
            await db.query(`
              INSERT INTO page_tag_relationships (page_id, tag_id)
              VALUES (?, ?)
            `, [pageId, tag.id]);
          }
        }
        
        await db.query('COMMIT');
        return true;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error setting page tags:', error);
      return false;
    }
  }

  /**
   * Get all dates that have published news articles (for calendar highlighting)
   */
  async getNewsDates(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT DATE_FORMAT(p.publish_date, '%Y-%m-%d') as date
        FROM pages p
        INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        WHERE pt.slug = 'news'
          AND p.status = 'published'
          AND p.publish_date IS NOT NULL
        ORDER BY date DESC
      `;
      
      const [rows] = await db.query(query);
      return (rows as any[]).map(row => row.date);
    } catch (error) {
      console.error('Error fetching news dates:', error);
      return [];
    }
  }

  /**
   * Get available years and months that have published news (for archive dropdown)
   */
  async getNewsArchiveDates(): Promise<{ year: number; month: number; monthName: string }[]> {
    try {
      const query = `
        SELECT DISTINCT 
          YEAR(p.publish_date) as year,
          MONTH(p.publish_date) as month
        FROM pages p
        INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        WHERE pt.slug = 'news'
          AND p.status = 'published'
          AND p.publish_date IS NOT NULL
        ORDER BY year DESC, month DESC
      `;
      
      const [rows] = await db.query(query);
      const monthNames = [
        '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
      ];
      
      return (rows as any[]).map(row => ({
        year: row.year,
        month: row.month,
        monthName: monthNames[row.month] || ''
      }));
    } catch (error) {
      console.error('Error fetching news archive dates:', error);
      return [];
    }
  }
}

export const pagesService = PagesService.getInstance();
