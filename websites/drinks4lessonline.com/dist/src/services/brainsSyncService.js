"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncBrainsStock = syncBrainsStock;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
const database_1 = require("../config/database");
const data_paths_1 = require("../constants/data-paths");
const imageThumbService_1 = require("./imageThumbService");
const IMAGE_DIR = path.resolve(process.cwd(), 'legacy/drinks/public_html/wp-content/uploads/product-images');
const LOG_DIR = path.resolve(process.cwd(), 'logs');
function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'brains-sync.log'), line + '\n');
}
function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}
async function fetchItems() {
    const url = process.env.BRAINS_API_URL;
    const key = process.env.BRAINS_API_KEY;
    const secret = process.env.BRAINS_API_SECRET;
    if (!url || !key || !secret)
        throw new Error('BRAINS_API_URL, BRAINS_API_KEY, and BRAINS_API_SECRET are required');
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    let lastError = 'Failed to connect to API';
    for (let attempt = 0; attempt < 10; attempt += 1) {
        log(`API START retry ${attempt}`);
        try {
            const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const body = await response.json();
            if (!Array.isArray(body.Content))
                throw new Error('API response has no Content array');
            return body.Content;
        }
        catch (error) {
            lastError = error.message;
            log(`API Error: ${lastError}. Retrying (${attempt + 1}/10)`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
    throw new Error(lastError);
}
async function categoryId(local, name, parentId) {
    const trimmed = name.trim();
    if (!trimmed)
        return null;
    const slug = slugify(trimmed);
    const [existing] = await local.query(`SELECT id FROM product_categories WHERE slug = ?`, [slug]);
    if (existing.length > 0)
        return existing[0].id;
    const [res] = await local.query(`INSERT INTO product_categories (name, slug, parent_id, is_active) VALUES (?, ?, ?, 1)`, [trimmed, slug, parentId]);
    return res.insertId;
}
async function brandId(local, name) {
    const trimmed = name.trim();
    if (!trimmed)
        return null;
    const slug = slugify(trimmed);
    const [existing] = await local.query(`SELECT id FROM brands WHERE slug = ?`, [slug]);
    if (existing.length > 0)
        return existing[0].id;
    const [res] = await local.query(`INSERT INTO brands (name, slug, is_active) VALUES (?, ?, 1)`, [trimmed, slug]);
    return res.insertId;
}
async function attachImage(local, productId, filename, title) {
    const source = path.join(IMAGE_DIR, filename);
    if (!filename || !fs.existsSync(source))
        return false;
    const dir = (0, data_paths_1.getProductImagesDirPath)(productId);
    fs.mkdirSync(dir, { recursive: true });
    const destName = `${productId}.webp`;
    await (0, sharp_1.default)(source).rotate().webp({ quality: 82 }).toFile(path.join(dir, destName));
    const url = (0, data_paths_1.getProductImagePublicUrl)(productId, destName);
    const thumb = await (0, imageThumbService_1.generateThumbForPublicUrl)(url);
    const [existing] = await local.query(`SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1`, [productId]);
    if (existing.length > 0) {
        await local.query(`UPDATE product_images SET image_url = ?, thumb_url = ? WHERE id = ?`, [url, thumb, existing[0].id]);
    }
    else {
        await local.query(`INSERT INTO product_images (product_id, image_url, thumb_url, is_primary, alt_text) VALUES (?, ?, ?, 1, ?)`, [productId, url, thumb, title]);
    }
    return true;
}
async function syncBrainsStock() {
    const items = await fetchItems();
    const local = await database_1.db.getPool().getConnection();
    let updated = 0;
    try {
        for (const item of items) {
            const sku = String(item.ProductCode || '').trim();
            const name = String(item.ProductName || '').trim();
            if (!sku || !name)
                continue;
            const qty = Number(item.AvQty || 0);
            const inStock = Number.isFinite(qty) && qty > 0;
            const price = Number(item.Saleprice || 0);
            const parent = await categoryId(local, String(item.Category || ''), null);
            const child = await categoryId(local, String(item.SubCategory || ''), parent);
            const brand = await brandId(local, String(item.Brand || ''));
            const [existing] = await local.query(`SELECT id, slug FROM products WHERE sku = ?`, [sku]);
            let productId;
            const statusValues = {
                name,
                short: String(item.ProductDetails || ''),
                price: Number.isFinite(price) ? price : 0,
                qty: inStock ? Math.floor(qty) : 0,
                categoryId: child || parent,
                brand
            };
            if (existing.length > 0) {
                productId = existing[0].id;
                await local.query(`UPDATE products SET name = ?, short_description = ?, price = ?, stock_quantity = ?, track_inventory = 1,
           category_id = COALESCE(?, category_id), brand_id = COALESCE(?, brand_id)
           WHERE id = ?`, [statusValues.name, statusValues.short, statusValues.price, statusValues.qty, statusValues.categoryId, statusValues.brand, productId]);
            }
            else {
                const slug = `${slugify(name)}-${slugify(sku)}`;
                const [res] = await local.query(`INSERT INTO products (name, slug, sku, short_description, price, stock_quantity, track_inventory, status, is_active, category_id, brand_id)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'draft', 0, ?, ?)`, [name, slug, sku, statusValues.short, statusValues.price, statusValues.qty, statusValues.categoryId, brand]);
                productId = res.insertId;
            }
            const pictured = item.ProductPicture ? await attachImage(local, productId, String(item.ProductPicture), name) : false;
            if (!item.ProductPicture || pictured) {
                const visible = pictured;
                await local.query(`UPDATE products SET status = ?, is_active = ? WHERE id = ?`, [visible ? 'published' : 'draft', visible ? 1 : 0, productId]);
            }
            if (!inStock)
                log(`${name} sku ${sku} : is out of stock`);
            if (!pictured)
                log(`No image for ${name} sku ${sku}`);
            updated += 1;
        }
    }
    finally {
        local.release();
    }
    log(`API END updated ${updated}`);
}
//# sourceMappingURL=brainsSyncService.js.map