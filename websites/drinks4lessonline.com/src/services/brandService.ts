import { db } from '../config/database';

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_featured: boolean;
  display_order: number;
}

/**
 * Normalize logo_url for consistent use in views (leading slash, forward slashes).
 */
function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (url == null || typeof url !== 'string') return null;
  let s = url.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!s) return null;
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

/** Get a string from row using any of the given keys (handles DB column name casing / Buffer). */
function getRowStr(row: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = typeof v === 'string' ? v : (Buffer.isBuffer(v) ? v.toString('utf8') : String(v));
    if (s.trim() !== '') return s.trim();
  }
  return null;
}

/** Map a DB row to a Brand with explicit fields and normalized logo_url. */
function rowToBrand(row: any): Brand {
  const logoRaw = getRowStr(row, 'logo_url', 'logo_URL', 'LOGO_URL') ?? row?.logo_url ?? null;
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? '').trim() || '',
    slug: String(row?.slug ?? '').trim() || '',
    description: row?.description != null ? String(row.description).trim() || null : null,
    logo_url: normalizeLogoUrl(logoRaw),
    website_url: row?.website_url != null ? String(row.website_url).trim() || null : null,
    is_featured: row?.is_featured === 1 || row?.is_featured === true,
    display_order: Number(row?.display_order ?? 0)
  };
}

class BrandService {
  /**
   * Get all active brands
   */
  async getActiveBrands(): Promise<Brand[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE is_active = TRUE 
         ORDER BY display_order ASC, name ASC`
      );

      if (!Array.isArray(rows)) return [];
      return rows.map((row: any) => rowToBrand(row));
    } catch (error) {
      console.error('Error getting active brands:', error);
      throw error;
    }
  }

  /**
   * Get featured brands
   */
  async getFeaturedBrands(): Promise<Brand[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE is_active = TRUE AND is_featured = TRUE 
         ORDER BY display_order ASC, name ASC`
      );

      if (!Array.isArray(rows)) return [];
      return rows.map((row: any) => rowToBrand(row));
    } catch (error) {
      console.error('Error getting featured brands:', error);
      throw error;
    }
  }

  /**
   * Get brand by slug
   */
  async getBrandBySlug(slug: string): Promise<Brand | null> {
    try {
      const [rows] = await db.query<any>(
        `SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE slug = ? AND is_active = TRUE`,
        [slug]
      );

      if (!Array.isArray(rows) || rows.length === 0) return null;
      return rowToBrand(rows[0]);
    } catch (error) {
      console.error('Error getting brand by slug:', error);
      throw error;
    }
  }
}

export default new BrandService();
