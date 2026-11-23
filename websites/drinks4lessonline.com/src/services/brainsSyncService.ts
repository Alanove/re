/**
 * Daily Brains catalogue sync. Upserts products by SKU and writes AvQty.
 * Credentials come from BRAINS_API_URL, BRAINS_API_KEY, and BRAINS_API_SECRET.
 */
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { db } from '../config/database';
import { getProductImagesDirPath, getProductImagePublicUrl } from '../constants/data-paths';
import { generateThumbForPublicUrl } from './imageThumbService';

const IMAGE_DIR = path.resolve(process.cwd(), 'legacy/drinks/public_html/wp-content/uploads/product-images');
const LOG_DIR = path.resolve(process.cwd(), 'logs');

interface BrainsItem {
  ProductCode?: string;
  ProductName?: string;
  Saleprice?: number | string;
  Category?: string;
  SubCategory?: string;
  ProductPicture?: string;
  ProductDetails?: string;
  AvQty?: number | string;
  Brand?: string;
  CountryOfOrigin?: string;
}

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, 'brains-sync.log'), line + '\n');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

async function fetchItems(): Promise<BrainsItem[]> {
  const url = process.env.BRAINS_API_URL;
  const key = process.env.BRAINS_API_KEY;
  const secret = process.env.BRAINS_API_SECRET;
  if (!url || !key || !secret) throw new Error('BRAINS_API_URL, BRAINS_API_KEY, and BRAINS_API_SECRET are required');
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  let lastError = 'Failed to connect to API';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    log(`API START retry ${attempt}`);
    try {
      const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { Content?: BrainsItem[] };
      if (!Array.isArray(body.Content)) throw new Error('API response has no Content array');
      return body.Content;
    } catch (error) {
      lastError = (error as Error).message;
      log(`API Error: ${lastError}. Retrying (${attempt + 1}/10)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(lastError);
}

async function categoryId(local: any, name: string, parentId: number | null): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed);
  const [existing] = await local.query(`SELECT id FROM product_categories WHERE slug = ?`, [slug]);
  if ((existing as any[]).length > 0) return (existing as any[])[0].id;
  const [res] = await local.query(
    `INSERT INTO product_categories (name, slug, parent_id, is_active) VALUES (?, ?, ?, 1)`,
    [trimmed, slug, parentId]
  );
  return (res as any).insertId;
}

async function brandId(local: any, name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed);
  const [existing] = await local.query(`SELECT id FROM brands WHERE slug = ?`, [slug]);
  if ((existing as any[]).length > 0) return (existing as any[])[0].id;
  const [res] = await local.query(
    `INSERT INTO brands (name, slug, is_active) VALUES (?, ?, 1)`,
    [trimmed, slug]
  );
  return (res as any).insertId;
}

async function attachImage(local: any, productId: number, filename: string, title: string): Promise<boolean> {
  const source = path.join(IMAGE_DIR, filename);
  if (!filename || !fs.existsSync(source)) return false;
  const dir = getProductImagesDirPath(productId);
  fs.mkdirSync(dir, { recursive: true });
  const destName = `${productId}.webp`;
  await sharp(source).rotate().webp({ quality: 82 }).toFile(path.join(dir, destName));
  const url = getProductImagePublicUrl(productId, destName);
  const thumb = await generateThumbForPublicUrl(url);
  const [existing] = await local.query(`SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1`, [productId]);
  if ((existing as any[]).length > 0) {
    await local.query(`UPDATE product_images SET image_url = ?, thumb_url = ? WHERE id = ?`, [url, thumb, (existing as any[])[0].id]);
  } else {
    await local.query(
      `INSERT INTO product_images (product_id, image_url, thumb_url, is_primary, alt_text) VALUES (?, ?, ?, 1, ?)`,
      [productId, url, thumb, title]
    );
  }
  return true;
}

export async function syncBrainsStock(): Promise<void> {
  const items = await fetchItems();
  const local = await db.getPool().getConnection();
  let updated = 0;
  try {
    for (const item of items) {
      const sku = String(item.ProductCode || '').trim();
      const name = String(item.ProductName || '').trim();
      if (!sku || !name) continue;
      const qty = Number(item.AvQty || 0);
      const inStock = Number.isFinite(qty) && qty > 0;
      const price = Number(item.Saleprice || 0);
      const parent = await categoryId(local, String(item.Category || ''), null);
      const child = await categoryId(local, String(item.SubCategory || ''), parent);
      const brand = await brandId(local, String(item.Brand || ''));
      const [existing] = await local.query(`SELECT id, slug FROM products WHERE sku = ?`, [sku]);
      let productId: number;
      const statusValues = {
        name,
        short: String(item.ProductDetails || ''),
        price: Number.isFinite(price) ? price : 0,
        qty: inStock ? Math.floor(qty) : 0,
        categoryId: child || parent,
        brand
      };
      if ((existing as any[]).length > 0) {
        productId = (existing as any[])[0].id;
        await local.query(
          `UPDATE products SET name = ?, short_description = ?, price = ?, stock_quantity = ?, track_inventory = 1,
           category_id = COALESCE(?, category_id), brand_id = COALESCE(?, brand_id)
           WHERE id = ?`,
          [statusValues.name, statusValues.short, statusValues.price, statusValues.qty, statusValues.categoryId, statusValues.brand, productId]
        );
      } else {
        const slug = `${slugify(name)}-${slugify(sku)}`;
        const [res] = await local.query(
          `INSERT INTO products (name, slug, sku, short_description, price, stock_quantity, track_inventory, status, is_active, category_id, brand_id)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'draft', 0, ?, ?)`,
          [name, slug, sku, statusValues.short, statusValues.price, statusValues.qty, statusValues.categoryId, brand]
        );
        productId = (res as any).insertId;
      }
      const pictured = item.ProductPicture ? await attachImage(local, productId, String(item.ProductPicture), name) : false;
      if (!item.ProductPicture || pictured) {
        const visible = pictured;
        await local.query(
          `UPDATE products SET status = ?, is_active = ? WHERE id = ?`,
          [visible ? 'published' : 'draft', visible ? 1 : 0, productId]
        );
      }
      if (!inStock) log(`${name} sku ${sku} : is out of stock`);
      if (!pictured) log(`No image for ${name} sku ${sku}`);
      updated += 1;
    }
  } finally {
    local.release();
  }
  log(`API END updated ${updated}`);
}
