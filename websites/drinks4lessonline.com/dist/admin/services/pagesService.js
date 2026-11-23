"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pagesService = exports.PagesService = void 0;
const database_1 = require("../../src/config/database");
const imageThumbService_1 = require("../../src/services/imageThumbService");
class PagesService {
    constructor() { }
    static getInstance() {
        if (!PagesService.instance) {
            PagesService.instance = new PagesService();
        }
        return PagesService.instance;
    }
    async getAllPages() {
        try {
            console.log('Debug - Attempting to fetch pages from database...');
            const [tables] = await database_1.db.query("SHOW TABLES LIKE 'pages'");
            console.log('Debug - Pages table exists:', tables.length > 0);
            if (tables.length === 0) {
                console.log('Debug - Pages table does not exist, returning empty array');
                return [];
            }
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, content,
          description,
          meta_description as metaDescription,
          meta_keywords as metaKeywords,
          status, template, parent_id as parentId,
          order_index as orderIndex,
          COALESCE(page_image, '') as pageImage,
          COALESCE(page_image_thumb, '') as pageImageThumb,
          COALESCE(seo_image, '') as seoImage,
          DATE_FORMAT(publish_date, '%Y-%m-%d') as publishDate,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM pages
        ORDER BY order_index, title
      `);
            console.log('Debug - Raw database rows:', rows);
            const transformedPages = await Promise.all(rows.map(async (page) => {
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
            console.log('Debug - Transformed pages:', transformedPages);
            return transformedPages;
        }
        catch (error) {
            console.error('Error fetching pages:', error);
            return [];
        }
    }
    async getPageById(id) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, content,
          description,
          meta_description as metaDescription,
          meta_keywords as metaKeywords,
          status, template, parent_id as parentId,
          order_index as orderIndex,
          COALESCE(page_image, '') as pageImage,
          COALESCE(page_image_thumb, '') as pageImageThumb,
          COALESCE(seo_image, '') as seoImage,
          DATE_FORMAT(publish_date, '%Y-%m-%d') as publishDate,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM pages
        WHERE id = ?
      `, [id]);
            const results = rows;
            const page = results[0] || null;
            if (page) {
                page.tags = await this.getPageTags(id);
            }
            return page;
        }
        catch (error) {
            console.error('Error fetching page by ID:', error);
            return null;
        }
    }
    async getPageBySlug(slug) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, content,
          description,
          meta_description as metaDescription,
          meta_keywords as metaKeywords,
          status, template, parent_id as parentId,
          order_index as orderIndex,
          COALESCE(page_image, '') as pageImage,
          COALESCE(page_image_thumb, '') as pageImageThumb,
          COALESCE(seo_image, '') as seoImage,
          DATE_FORMAT(publish_date, '%Y-%m-%d') as publishDate,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM pages
        WHERE slug = ?
      `, [slug]);
            const results = rows;
            const page = results[0] || null;
            if (page) {
                page.tags = await this.getPageTags(page.id);
            }
            return page;
        }
        catch (error) {
            console.error('Error fetching page by slug:', error);
            return null;
        }
    }
    async getPageByKey(key) {
        try {
            const pageBySlug = await this.getPageBySlug(key);
            if (pageBySlug) {
                return pageBySlug;
            }
            const numericKey = parseInt(key);
            if (!isNaN(numericKey)) {
                return await this.getPageById(numericKey);
            }
            return null;
        }
        catch (error) {
            console.error('Error fetching page by key:', error);
            return null;
        }
    }
    async createPage(pageData) {
        try {
            const [allColumns] = await database_1.db.query(`
        SELECT COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE, EXTRA, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pages'
        ORDER BY ORDINAL_POSITION
      `);
            const existingColumns = new Set();
            const columnMetadata = new Map();
            if (Array.isArray(allColumns)) {
                allColumns.forEach((col) => {
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
            const columns = ['title', 'slug', 'content'];
            const values = [pageData.title, pageData.slug, pageData.content];
            const placeholders = ['?', '?', '?'];
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
            const sql = `INSERT INTO pages (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            console.log('DEBUG createPage SQL:', sql);
            console.log('DEBUG createPage columns:', columns);
            console.log('DEBUG createPage columns count:', columns.length);
            console.log('DEBUG createPage values:', values);
            console.log('DEBUG createPage values count:', values.length);
            console.log('DEBUG createPage placeholders count:', placeholders.length);
            if (columns.length !== values.length || columns.length !== placeholders.length) {
                throw new Error(`Column/Value count mismatch: columns=${columns.length}, values=${values.length}, placeholders=${placeholders.length}`);
            }
            const [result] = await database_1.db.query(sql, values);
            const insertId = result.insertId;
            if (pageData.pageImage && String(pageData.pageImage).trim()) {
                await this.refreshPageImageThumb(insertId);
            }
            const newPage = await this.getPageById(insertId);
            if (!newPage)
                throw new Error('Failed to retrieve created page');
            if (pageData.tags && pageData.tags.length > 0) {
                const tagNames = pageData.tags.map(tag => typeof tag === 'string' ? tag : tag.name);
                await this.setPageTags(insertId, tagNames);
                return await this.getPageById(insertId) || newPage;
            }
            return newPage;
        }
        catch (error) {
            console.error('Error creating page:', error);
            throw new Error('Failed to create page');
        }
    }
    async updatePage(id, updates) {
        try {
            const updateFields = [];
            const values = [];
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
            await database_1.db.query(`
        UPDATE pages
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
            if (updates.pageImage !== undefined) {
                await this.refreshPageImageThumb(id);
            }
            return await this.getPageById(id);
        }
        catch (error) {
            console.error('Error updating page:', error);
            return null;
        }
    }
    async deletePage(id) {
        try {
            await database_1.db.query('START TRANSACTION');
            try {
                await database_1.db.query(`
          DELETE FROM page_tag_relationships WHERE page_id = ?
        `, [id]);
                await database_1.db.query(`
          DELETE FROM page_photos WHERE page_id = ?
        `, [id]);
                await database_1.db.query(`
          UPDATE pages SET parent_id = NULL WHERE parent_id = ?
        `, [id]);
                const [result] = await database_1.db.query(`
          DELETE FROM pages WHERE id = ?
        `, [id]);
                await database_1.db.query('COMMIT');
                return result.affectedRows > 0;
            }
            catch (error) {
                await database_1.db.query('ROLLBACK');
                throw error;
            }
        }
        catch (error) {
            console.error('Error deleting page:', error);
            return false;
        }
    }
    async getPublishedPages() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, content,
          description,
          meta_description as metaDescription,
          meta_keywords as metaKeywords,
          status, template, parent_id as parentId,
          order_index as orderIndex,
          COALESCE(page_image, '') as pageImage,
          COALESCE(page_image_thumb, '') as pageImageThumb,
          COALESCE(seo_image, '') as seoImage,
          DATE_FORMAT(publish_date, '%Y-%m-%d') as publishDate,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM pages
        WHERE status = 'published'
        ORDER BY order_index, title
      `);
            return rows;
        }
        catch (error) {
            console.error('Error fetching published pages:', error);
            return [];
        }
    }
    async refreshPageImageThumb(pageId) {
        try {
            const [cols] = await database_1.db.query(`SHOW COLUMNS FROM pages WHERE Field = ?`, ['page_image_thumb']);
            if (!cols || cols.length === 0)
                return;
            const page = await this.getPageById(pageId);
            if (!page?.pageImage || !String(page.pageImage).trim()) {
                await database_1.db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
                return;
            }
            const url = String(page.pageImage).trim();
            if (/^https?:\/\//i.test(url)) {
                await database_1.db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
                return;
            }
            const thumb = await (0, imageThumbService_1.generateThumbForPublicUrl)(url);
            if (thumb) {
                await database_1.db.query(`UPDATE pages SET page_image_thumb = ? WHERE id = ?`, [thumb, pageId]);
            }
            else {
                await database_1.db.query(`UPDATE pages SET page_image_thumb = NULL WHERE id = ?`, [pageId]);
            }
        }
        catch (e) {
            console.error('refreshPageImageThumb failed', pageId, e);
        }
    }
    async getPagePhotos(pageId) {
        try {
            const [rows] = await database_1.db.query(`
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
            const photos = rows;
            const page = await this.getPageById(pageId);
            if (page && page.slug) {
                return photos.map(photo => {
                    if (photo.filePath) {
                        const updatedPath = photo.filePath.replace(/\/pages\/[^\/]+\/gallery\//, `/pages/${page.slug}/gallery/`);
                        const thumbSrc = (0, imageThumbService_1.resolveListingThumbUrl)(updatedPath, photo.thumbUrl ?? null) || updatedPath;
                        return {
                            ...photo,
                            filePath: updatedPath,
                            thumbSrc
                        };
                    }
                    const thumbSrc = (0, imageThumbService_1.resolveListingThumbUrl)(photo.filePath, photo.thumbUrl ?? null) || photo.filePath;
                    return { ...photo, thumbSrc };
                });
            }
            return photos.map(p => ({
                ...p,
                thumbSrc: (0, imageThumbService_1.resolveListingThumbUrl)(p.filePath, p.thumbUrl ?? null) || p.filePath
            }));
        }
        catch (error) {
            console.error('Error fetching page photos:', error);
            return [];
        }
    }
    async addPagePhoto(pageId, filename, filePath) {
        try {
            const [maxOrderResult] = await database_1.db.query(`
        SELECT COALESCE(MAX(display_order), 0) as maxOrder
        FROM page_photos
        WHERE page_id = ?
      `, [pageId]);
            const maxOrder = maxOrderResult[0]?.maxOrder || 0;
            const displayOrder = maxOrder + 1;
            const [result] = await database_1.db.query(`
        INSERT INTO page_photos (page_id, filename, file_path, display_order)
        VALUES (?, ?, ?, ?)
      `, [pageId, filename, filePath, displayOrder]);
            const insertId = result.insertId;
            const thumb = await (0, imageThumbService_1.generateThumbForPublicUrl)(filePath);
            if (thumb) {
                await database_1.db.query(`UPDATE page_photos SET thumb_url = ? WHERE id = ?`, [thumb, insertId]);
            }
            const [rows] = await database_1.db.query(`
        SELECT 
          id, page_id as pageId, filename, file_path as filePath,
          thumb_url as thumbUrl,
          display_order as displayOrder,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM page_photos
        WHERE id = ?
      `, [insertId]);
            const row = rows[0];
            if (!row)
                return null;
            return {
                ...row,
                thumbSrc: (0, imageThumbService_1.resolveListingThumbUrl)(row.filePath, row.thumbUrl ?? null) || row.filePath
            };
        }
        catch (error) {
            console.error('Error adding page photo:', error);
            throw error;
        }
    }
    async deletePagePhoto(photoId) {
        try {
            const [result] = await database_1.db.query(`
        DELETE FROM page_photos WHERE id = ?
      `, [photoId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting page photo:', error);
            return false;
        }
    }
    async reorderPagePhotos(pageId, photoOrders) {
        try {
            await database_1.db.query('START TRANSACTION');
            try {
                for (const { id, order } of photoOrders) {
                    await database_1.db.query(`
            UPDATE page_photos
            SET display_order = ?
            WHERE id = ? AND page_id = ?
          `, [order, id, pageId]);
                }
                await database_1.db.query('COMMIT');
                return true;
            }
            catch (error) {
                await database_1.db.query('ROLLBACK');
                throw error;
            }
        }
        catch (error) {
            console.error('Error reordering page photos:', error);
            return false;
        }
    }
    async getPageTags(pageId) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          pt.id, pt.name, pt.slug
        FROM page_tags pt
        INNER JOIN page_tag_relationships ptr ON pt.id = ptr.tag_id
        WHERE ptr.page_id = ?
        ORDER BY pt.name ASC
      `, [pageId]);
            return rows;
        }
        catch (error) {
            console.error('Error fetching page tags:', error);
            return [];
        }
    }
    async getAllTags() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT id, name, slug
        FROM page_tags
        ORDER BY name ASC
      `);
            return rows;
        }
        catch (error) {
            console.error('Error fetching all tags:', error);
            return [];
        }
    }
    async getTopTags(limit = 10) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT pt.id, pt.name, pt.slug
        FROM page_tags pt
        LEFT JOIN page_tag_relationships ptr ON pt.id = ptr.tag_id
        GROUP BY pt.id, pt.name, pt.slug
        ORDER BY COUNT(ptr.page_id) DESC, pt.name ASC
        LIMIT ?
      `, [limit]);
            return rows;
        }
        catch (error) {
            console.error('Error fetching top tags:', error);
            return [];
        }
    }
    async getPagesWithPagination(options) {
        try {
            const page = options.page || 1;
            const itemsPerPage = options.itemsPerPage || 20;
            const offset = (page - 1) * itemsPerPage;
            const whereConditions = [];
            const params = [];
            const hasTagFilter = !!options.tag;
            const isNoTagFilter = options.tag === '__no_tag__';
            if (options.keyword) {
                whereConditions.push('(p.title LIKE ? OR p.slug LIKE ? OR p.content LIKE ?)');
                const keywordPattern = `%${options.keyword}%`;
                params.push(keywordPattern, keywordPattern, keywordPattern);
            }
            if (options.status) {
                whereConditions.push('p.status = ?');
                params.push(options.status);
            }
            if (hasTagFilter && !isNoTagFilter) {
                whereConditions.push('pt.slug = ?');
                params.push(options.tag);
            }
            if (isNoTagFilter) {
                whereConditions.push('ptr.page_id IS NULL');
            }
            if (options.year !== undefined) {
                if (options.month !== undefined) {
                    if (options.day !== undefined) {
                        whereConditions.push('YEAR(p.publish_date) = ? AND MONTH(p.publish_date) = ? AND DAY(p.publish_date) = ?');
                        params.push(options.year, options.month, options.day);
                    }
                    else {
                        whereConditions.push('YEAR(p.publish_date) = ? AND MONTH(p.publish_date) = ?');
                        params.push(options.year, options.month);
                    }
                }
                else {
                    whereConditions.push('YEAR(p.publish_date) = ?');
                    params.push(options.year);
                }
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            let countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM pages p
      `;
            if (hasTagFilter && !isNoTagFilter) {
                countQuery += `
          INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
          INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        `;
            }
            else if (isNoTagFilter) {
                countQuery += `
          LEFT JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        `;
            }
            countQuery += ' ' + whereClause;
            const [countResult] = await database_1.db.query(countQuery, params);
            const total = countResult[0]?.total || 0;
            let mainQuery = `
        SELECT 
          p.id, p.title, p.slug, p.content,
          p.description,
          p.meta_description as metaDescription,
          p.meta_keywords as metaKeywords,
          p.status, p.template, p.parent_id as parentId,
          p.order_index as orderIndex,
          COALESCE(p.page_image, '') as pageImage,
          COALESCE(p.page_image_thumb, '') as pageImageThumb,
          COALESCE(p.seo_image, '') as seoImage,
          DATE_FORMAT(p.publish_date, '%Y-%m-%d') as publishDate,
          DATE_FORMAT(p.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(p.updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM pages p
      `;
            if (hasTagFilter && !isNoTagFilter) {
                mainQuery += `
          INNER JOIN page_tag_relationships ptr ON p.id = ptr.page_id
          INNER JOIN page_tags pt ON ptr.tag_id = pt.id
        `;
            }
            else if (isNoTagFilter) {
                mainQuery += `
          LEFT JOIN page_tag_relationships ptr ON p.id = ptr.page_id
        `;
            }
            mainQuery += ' ' + whereClause;
            const orderClause = ` ORDER BY ISNULL(p.publish_date), p.publish_date DESC, p.created_at DESC, p.title ASC`;
            mainQuery += isNoTagFilter ? `${orderClause} LIMIT ? OFFSET ?` : ` GROUP BY p.id ${orderClause} LIMIT ? OFFSET ?`;
            const queryParams = [...params, itemsPerPage, offset];
            const [rows] = await database_1.db.query(mainQuery, queryParams);
            const transformedPages = await Promise.all(rows.map(async (page) => {
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
        }
        catch (error) {
            console.error('Error fetching pages with pagination:', error);
            return {
                pages: [],
                total: 0
            };
        }
    }
    async searchPages(keyword, limit = 20) {
        try {
            if (!keyword || keyword.trim().length === 0) {
                return [];
            }
            const trimmedKeyword = keyword.trim();
            const searchTerm = `%${trimmedKeyword}%`;
            const exactSlugMatch = await this.getPageBySlug(trimmedKeyword);
            const exactMatches = [];
            if (exactSlugMatch) {
                exactMatches.push({
                    id: exactSlugMatch.id,
                    title: exactSlugMatch.title,
                    key: exactSlugMatch.slug,
                    slug: exactSlugMatch.slug
                });
            }
            const [rows] = await database_1.db.query(`
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
            const otherMatches = rows.map(page => ({
                id: page.id,
                title: page.title,
                key: page.slug,
                slug: page.slug
            }));
            return [...exactMatches, ...otherMatches];
        }
        catch (error) {
            console.error('Error searching pages:', error);
            return [];
        }
    }
    async findOrCreateTag(tagName) {
        try {
            const slug = tagName
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const [existingRows] = await database_1.db.query(`
        SELECT id, name, slug
        FROM page_tags
        WHERE slug = ? OR name = ?
        LIMIT 1
      `, [slug, tagName.trim()]);
            if (Array.isArray(existingRows) && existingRows.length > 0) {
                return existingRows[0];
            }
            const [result] = await database_1.db.query(`
        INSERT INTO page_tags (name, slug)
        VALUES (?, ?)
      `, [tagName.trim(), slug]);
            const insertId = result.insertId;
            const [rows] = await database_1.db.query(`
        SELECT id, name, slug
        FROM page_tags
        WHERE id = ?
      `, [insertId]);
            return rows[0];
        }
        catch (error) {
            console.error('Error finding or creating tag:', error);
            throw error;
        }
    }
    async setPageTags(pageId, tagNames) {
        try {
            await database_1.db.query('START TRANSACTION');
            try {
                await database_1.db.query(`
          DELETE FROM page_tag_relationships
          WHERE page_id = ?
        `, [pageId]);
                for (const tagName of tagNames) {
                    if (tagName && tagName.trim()) {
                        const tag = await this.findOrCreateTag(tagName.trim());
                        await database_1.db.query(`
              INSERT INTO page_tag_relationships (page_id, tag_id)
              VALUES (?, ?)
            `, [pageId, tag.id]);
                    }
                }
                await database_1.db.query('COMMIT');
                return true;
            }
            catch (error) {
                await database_1.db.query('ROLLBACK');
                throw error;
            }
        }
        catch (error) {
            console.error('Error setting page tags:', error);
            return false;
        }
    }
    async getNewsDates() {
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
            const [rows] = await database_1.db.query(query);
            return rows.map(row => row.date);
        }
        catch (error) {
            console.error('Error fetching news dates:', error);
            return [];
        }
    }
    async getNewsArchiveDates() {
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
            const [rows] = await database_1.db.query(query);
            const monthNames = [
                '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
            ];
            return rows.map(row => ({
                year: row.year,
                month: row.month,
                monthName: monthNames[row.month] || ''
            }));
        }
        catch (error) {
            console.error('Error fetching news archive dates:', error);
            return [];
        }
    }
}
exports.PagesService = PagesService;
exports.pagesService = PagesService.getInstance();
//# sourceMappingURL=pagesService.js.map