import { db } from '../../src/config/database';
import * as mysql from 'mysql2/promise';

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BrandData {
  name: string;
  slug?: string | undefined;
  description?: string | undefined;
  logo_url?: string | undefined;
  website_url?: string | undefined;
  is_featured?: boolean | undefined;
  display_order?: number | undefined;
  is_active?: boolean | undefined;
  meta_title?: string | undefined;
  meta_description?: string | undefined;
  meta_keywords?: string | undefined;
}

export class BrandManagementService {
  private static instance: BrandManagementService;

  private constructor() {}

  public static getInstance(): BrandManagementService {
    if (!BrandManagementService.instance) {
      BrandManagementService.instance = new BrandManagementService();
    }
    return BrandManagementService.instance;
  }

  /**
   * Get all brands
   */
  public async getAllBrands(includeInactive: boolean = false): Promise<Brand[]> {
    try {
      const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
      const [rows] = await db.query<any>(
        `SELECT * FROM brands ${whereClause} ORDER BY display_order ASC, name ASC`
      );
      const list = Array.isArray(rows) ? rows : [];
      return list.map((row: any) => ({
        ...row,
        is_featured: row.is_featured === 1 || row.is_featured === true,
        is_active: row.is_active === 1 || row.is_active === true
      }));
    } catch (error) {
      console.error('Error getting brands:', error);
      throw error;
    }
  }

  /**
   * Get brand by ID
   */
  public async getBrandById(id: number): Promise<Brand | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM brands WHERE id = ?',
        [id]
      );

      if (rows.length === 0) return null;

      const brand = rows[0] as any;
      return {
        ...brand,
        is_featured: brand.is_featured === 1 || brand.is_featured === true,
        is_active: brand.is_active === 1 || brand.is_active === true
      };
    } catch (error) {
      console.error('Error getting brand:', error);
      throw error;
    }
  }

  /**
   * Get brand by slug
   */
  public async getBrandBySlug(slug: string): Promise<Brand | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM brands WHERE slug = ?',
        [slug]
      );

      if (rows.length === 0) return null;

      const brand = rows[0] as any;
      return {
        ...brand,
        is_featured: brand.is_featured === 1 || brand.is_featured === true,
        is_active: brand.is_active === 1 || brand.is_active === true
      };
    } catch (error) {
      console.error('Error getting brand by slug:', error);
      throw error;
    }
  }

  /**
   * Create brand
   */
  public async createBrand(data: BrandData): Promise<number> {
    try {
      const slug = data.slug || this.generateSlug(data.name);

      const [result] = await db.query(
        `INSERT INTO brands (
          name, slug, description, logo_url, website_url, is_featured, 
          display_order, is_active, meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          slug,
          data.description || null,
          data.logo_url || null,
          data.website_url || null,
          data.is_featured || false,
          data.display_order || 0,
          data.is_active !== undefined ? data.is_active : true,
          data.meta_title || null,
          data.meta_description || null,
          data.meta_keywords || null
        ]
      );

      return (result as unknown as mysql.ResultSetHeader).insertId;
    } catch (error) {
      console.error('Error creating brand:', error);
      throw error;
    }
  }

  /**
   * Update brand
   */
  public async updateBrand(id: number, data: Partial<BrandData>): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.slug !== undefined) {
        updates.push('slug = ?');
        values.push(data.slug);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.logo_url !== undefined) {
        updates.push('logo_url = ?');
        values.push(data.logo_url);
      }
      if (data.website_url !== undefined) {
        updates.push('website_url = ?');
        values.push(data.website_url);
      }
      if (data.is_featured !== undefined) {
        updates.push('is_featured = ?');
        values.push(data.is_featured);
      }
      if (data.display_order !== undefined) {
        updates.push('display_order = ?');
        values.push(data.display_order);
      }
      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(data.is_active);
      }
      if (data.meta_title !== undefined) {
        updates.push('meta_title = ?');
        values.push(data.meta_title);
      }
      if (data.meta_description !== undefined) {
        updates.push('meta_description = ?');
        values.push(data.meta_description);
      }
      if (data.meta_keywords !== undefined) {
        updates.push('meta_keywords = ?');
        values.push(data.meta_keywords);
      }

      if (updates.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE brands SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }
    } catch (error) {
      console.error('Error updating brand:', error);
      throw error;
    }
  }

  /**
   * Delete brand
   */
  public async deleteBrand(id: number): Promise<void> {
    try {
      await db.query('DELETE FROM brands WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting brand:', error);
      throw error;
    }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get featured brands
   */
  public async getFeaturedBrands(): Promise<Brand[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT * FROM brands 
         WHERE is_featured = TRUE AND is_active = TRUE 
         ORDER BY display_order ASC, name ASC`
      );

      return rows.map((row: any) => ({
        ...row,
        is_featured: row.is_featured === 1 || row.is_featured === true,
        is_active: row.is_active === 1 || row.is_active === true
      }));
    } catch (error) {
      console.error('Error getting featured brands:', error);
      throw error;
    }
  }
}
