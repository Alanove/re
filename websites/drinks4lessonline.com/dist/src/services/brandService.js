"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
function normalizeLogoUrl(url) {
    if (url == null || typeof url !== 'string')
        return null;
    let s = url.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!s)
        return null;
    if (!s.startsWith('/'))
        s = '/' + s;
    return s;
}
function getRowStr(row, ...keys) {
    for (const k of keys) {
        const v = row[k];
        if (v == null)
            continue;
        const s = typeof v === 'string' ? v : (Buffer.isBuffer(v) ? v.toString('utf8') : String(v));
        if (s.trim() !== '')
            return s.trim();
    }
    return null;
}
function rowToBrand(row) {
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
    async getActiveBrands() {
        try {
            const [rows] = await database_1.db.query(`SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE is_active = TRUE 
         ORDER BY display_order ASC, name ASC`);
            if (!Array.isArray(rows))
                return [];
            return rows.map((row) => rowToBrand(row));
        }
        catch (error) {
            console.error('Error getting active brands:', error);
            throw error;
        }
    }
    async getFeaturedBrands() {
        try {
            const [rows] = await database_1.db.query(`SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE is_active = TRUE AND is_featured = TRUE 
         ORDER BY display_order ASC, name ASC`);
            if (!Array.isArray(rows))
                return [];
            return rows.map((row) => rowToBrand(row));
        }
        catch (error) {
            console.error('Error getting featured brands:', error);
            throw error;
        }
    }
    async getBrandBySlug(slug) {
        try {
            const [rows] = await database_1.db.query(`SELECT id, name, slug, description, logo_url, website_url, is_featured, display_order
         FROM brands 
         WHERE slug = ? AND is_active = TRUE`, [slug]);
            if (!Array.isArray(rows) || rows.length === 0)
                return null;
            return rowToBrand(rows[0]);
        }
        catch (error) {
            console.error('Error getting brand by slug:', error);
            throw error;
        }
    }
}
exports.default = new BrandService();
//# sourceMappingURL=brandService.js.map