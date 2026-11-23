/**
 * Import the Drinks4Less WooCommerce backup into this shop.
 * Idempotent on category slug, brand slug, product SKU, user email, page slug, and order number.
 *
 * Usage: npm run import:woocommerce
 */
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sharp from 'sharp';
import mysql from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import { getProductImagesDirPath, getProductImagePublicUrl } from '../src/constants/data-paths';
import { generateThumbForPublicUrl } from '../src/services/imageThumbService';
import encryptionService from '../src/services/encryptionService';

const WP_PREFIX = 'wp_';
const UPLOADS = path.resolve(process.cwd(), 'legacy/drinks/public_html/wp-content/uploads');
const SKIP_ORDER_IDS = new Set([17893, 17894]);
const SKIP_USER_IDS = new Set([
  3, 7, 9, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 28, 29, 32, 67, 68, 76, 77, 78
]);
const CONTENT_PAGES = new Set([
  'our-story',
  'contact-us',
  'faqs',
  'terms-and-conditions',
  'careers',
  'shipment-policy',
  'privacy-policy'
]);

const ADMINS = [
  { email: 'george@wadihco.com', username: 'george', role: 'Admin' },
  { email: 'roubarizk@yahoo.com', username: 'Rouba', role: 'Admin' },
  { email: 'alanove@gmail.com', username: 'alanove', role: 'Super Admin' }
];

function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'item';
}

function stripShortcodes(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\[(\/)?[a-zA-Z0-9_-]+[^\]]*\]/g, '')
    .trim();
}

function money(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1000000) return 0;
  return Math.round(n * 100) / 100;
}

async function main(): Promise<void> {
  const wp = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: 'drinks',
    waitForConnections: true,
    connectionLimit: 4
  });
  const local = await db.getPool().getConnection();
  const passwords: string[] = [];

  try {
    await ensurePhoneColumn(local);
    const categoryMap = await importCategories(wp, local);
    const brandMap = await importBrands(wp, local);
    const productMap = await importProducts(wp, local, categoryMap, brandMap);
    const userMap = await importUsers(wp, local, passwords);
    await importPages(wp, local);
    await importMenu(local);
    await importOrders(wp, local, productMap, userMap);
    await importSettings(local);
    const passwordFile = path.resolve(process.cwd(), 'legacy/admin-passwords.txt');
    fs.writeFileSync(passwordFile, passwords.join('\n') + '\n', 'utf8');
    console.log(`Admin passwords written to ${passwordFile}`);
  } finally {
    local.release();
    await wp.end();
    await db.close();
  }
}

async function ensurePhoneColumn(local: mysql.PoolConnection): Promise<void> {
  const [cols] = await local.query<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'`
  );
  if (cols.length === 0) {
    await local.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER email`);
  }
}

async function importCategories(wp: mysql.Pool, local: mysql.PoolConnection): Promise<Map<number, number>> {
  console.log('Categories...');
  const [terms] = await wp.query<any[]>(
    `SELECT t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
     FROM ${WP_PREFIX}terms t
     JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
     WHERE tt.taxonomy = 'product_cat'
     ORDER BY tt.parent ASC, t.term_id ASC`
  );
  const map = new Map<number, number>();
  const pending = terms.map((t) => ({ ...t }));
  let guard = 0;
  while (pending.length > 0 && guard < 20) {
    guard += 1;
    const ready = pending.filter((t) => t.parent === 0 || map.has(t.parent));
    if (ready.length === 0) break;
    for (const term of ready) {
      const parentId = term.parent ? map.get(term.parent) ?? null : null;
      const inactive = /not for sale/i.test(term.name) || Number(term.count) === 0;
      const slug = term.slug || slugify(term.name);
      const [existing] = await local.query<any[]>(`SELECT id FROM product_categories WHERE slug = ?`, [slug]);
      let id: number;
      if (existing.length > 0) {
        id = existing[0].id;
        await local.query(
          `UPDATE product_categories SET name = ?, description = ?, parent_id = ?, is_active = ? WHERE id = ?`,
          [term.name, term.description || '', parentId, inactive ? 0 : 1, id]
        );
      } else {
        const [res] = await local.query<any>(
          `INSERT INTO product_categories (name, slug, description, parent_id, is_active) VALUES (?, ?, ?, ?, ?)`,
          [term.name, slug, term.description || '', parentId, inactive ? 0 : 1]
        );
        id = res.insertId;
      }
      map.set(term.term_id, id);
      pending.splice(pending.indexOf(term), 1);
    }
  }
  console.log(`  ${map.size} categories`);
  return map;
}

async function importBrands(wp: mysql.Pool, local: mysql.PoolConnection): Promise<Map<number, number>> {
  console.log('Brands...');
  const [terms] = await wp.query<any[]>(
    `SELECT t.term_id, t.name, t.slug, tt.description
     FROM ${WP_PREFIX}terms t
     JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
     WHERE tt.taxonomy = 'pa_brand'`
  );
  const map = new Map<number, number>();
  for (const term of terms) {
    const slug = term.slug || slugify(term.name);
    const [existing] = await local.query<any[]>(`SELECT id FROM brands WHERE slug = ?`, [slug]);
    let id: number;
    if (existing.length > 0) {
      id = existing[0].id;
      await local.query(`UPDATE brands SET name = ?, description = ?, is_active = 1 WHERE id = ?`, [term.name, term.description || '', id]);
    } else {
      const [res] = await local.query<any>(
        `INSERT INTO brands (name, slug, description, is_active) VALUES (?, ?, ?, 1)`,
        [term.name, slug, term.description || '']
      );
      id = res.insertId;
    }
    map.set(term.term_id, id);
  }
  console.log(`  ${map.size} brands`);
  return map;
}

async function metaMap(wp: mysql.Pool, postId: number): Promise<Record<string, string>> {
  const [rows] = await wp.query<any[]>(
    `SELECT meta_key, meta_value FROM ${WP_PREFIX}postmeta WHERE post_id = ?`,
    [postId]
  );
  const out: Record<string, string> = {};
  for (const row of rows) out[row.meta_key] = row.meta_value ?? '';
  return out;
}

async function importProducts(
  wp: mysql.Pool,
  local: mysql.PoolConnection,
  categoryMap: Map<number, number>,
  brandMap: Map<number, number>
): Promise<Map<number, number>> {
  console.log('Products...');
  const [products] = await wp.query<any[]>(
    `SELECT ID, post_title, post_name, post_excerpt, post_status, post_date
     FROM ${WP_PREFIX}posts
     WHERE post_type = 'product' AND post_status IN ('publish', 'draft')`
  );
  const map = new Map<number, number>();
  let images = 0;
  for (const product of products) {
    const meta = await metaMap(wp, product.ID);
    const sku = (meta._sku || `WP-${product.ID}`).trim();
    const status = product.post_status === 'publish' ? 'published' : 'draft';
    let slug = product.post_name || slugify(product.post_title);
    if (status === 'draft') slug = `${slug}-${product.ID}`;
    const price = money(meta._price || meta._regular_price);
    const regular = money(meta._regular_price);
    const inStock = meta._stock_status !== 'outofstock';
    const rawQty = meta._stock === undefined || meta._stock === '' ? null : parseInt(meta._stock, 10);
    const track = rawQty !== null && Number.isFinite(rawQty);
    const qty = track ? rawQty : inStock ? 0 : 0;
    const [taxes] = await wp.query<any[]>(
      `SELECT tt.term_id, tt.taxonomy
       FROM ${WP_PREFIX}term_relationships tr
       JOIN ${WP_PREFIX}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
       WHERE tr.object_id = ?`,
      [product.ID]
    );
    const categoryIds = taxes.map((t) => categoryMap.get(t.term_id)).filter((id): id is number => !!id);
    const brandTerm = taxes.find((t) => brandMap.has(t.term_id));
    const brandId = brandTerm ? brandMap.get(brandTerm.term_id)! : null;
    const categoryId = categoryIds[0] ?? null;
    const [existing] = await local.query<any[]>(`SELECT id FROM products WHERE sku = ?`, [sku]);
    let id: number;
    const values = [
      product.post_title,
      slug,
      product.post_excerpt || '',
      price,
      regular > price ? regular : null,
      qty,
      track || !inStock ? 1 : 0,
      status,
      status === 'published' ? 1 : 0,
      categoryId,
      brandId
    ];
    if (existing.length > 0) {
      id = existing[0].id;
      await local.query(
        `UPDATE products SET name = ?, slug = ?, short_description = ?, price = ?, compare_at_price = ?,
         stock_quantity = ?, track_inventory = ?, status = ?, is_active = ?, category_id = ?, brand_id = ?
         WHERE id = ?`,
        [...values, id]
      );
    } else {
      const [res] = await local.query<any>(
        `INSERT INTO products (
           name, slug, sku, short_description, price, compare_at_price, stock_quantity, track_inventory,
           status, is_active, category_id, brand_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [product.post_title, slug, sku, product.post_excerpt || '', price, regular > price ? regular : null, qty, track || !inStock ? 1 : 0, status, status === 'published' ? 1 : 0, categoryId, brandId, product.post_date]
      );
      id = res.insertId;
    }
    map.set(product.ID, id);
    for (const category of categoryIds) {
      await local.query(
        `INSERT IGNORE INTO product_categories_map (product_id, category_id, is_primary) VALUES (?, ?, ?)`,
        [id, category, category === categoryId ? 1 : 0]
      );
      await local.query(
        `INSERT IGNORE INTO product_category_relations (product_id, category_id) VALUES (?, ?)`,
        [id, category]
      );
    }
    const thumb = meta._thumbnail_id ? parseInt(meta._thumbnail_id, 10) : 0;
    if (thumb) {
      const [hasImage] = await local.query<any[]>(
        `SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1`,
        [id]
      );
      if (hasImage.length === 0) {
        const url = await saveWebp(wp, thumb, id);
        if (url) {
          const thumbUrl = await generateThumbForPublicUrl(url);
          await local.query(
            `INSERT INTO product_images (product_id, image_url, thumb_url, is_primary, alt_text) VALUES (?, ?, ?, 1, ?)`,
            [id, url, thumbUrl, product.post_title]
          );
          images += 1;
        }
      }
    }
  }
  console.log(`  ${map.size} products, ${images} new images`);
  return map;
}

async function saveWebp(wp: mysql.Pool, attachmentId: number, productId: number): Promise<string | null> {
  const [rows] = await wp.query<any[]>(
    `SELECT meta_value FROM ${WP_PREFIX}postmeta WHERE post_id = ? AND meta_key = '_wp_attached_file'`,
    [attachmentId]
  );
  if (rows.length === 0 || !rows[0].meta_value) return null;
  const source = path.join(UPLOADS, String(rows[0].meta_value).replace(/\//g, path.sep));
  if (!fs.existsSync(source)) return null;
  const dir = getProductImagesDirPath(productId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${productId}.webp`;
  const dest = path.join(dir, filename);
  try {
    await sharp(source).rotate().webp({ quality: 82 }).toFile(dest);
  } catch (error) {
    console.warn(`  image ${attachmentId} skipped: ${(error as Error).message}`);
    return null;
  }
  return getProductImagePublicUrl(productId, filename);
}

async function importUsers(wp: mysql.Pool, local: mysql.PoolConnection, passwords: string[]): Promise<Map<number, number>> {
  console.log('Users...');
  const [users] = await wp.query<any[]>(
    `SELECT ID, user_login, user_email, display_name, user_registered FROM ${WP_PREFIX}users`
  );
  const map = new Map<number, number>();
  for (const user of users) {
    const email = String(user.user_email || '').trim().toLowerCase();
    if (!email || email.endsWith('@tedmob.com') || SKIP_USER_IDS.has(user.ID)) continue;
    if (ADMINS.some((admin) => admin.email === email)) continue;
    const [caps] = await wp.query<any[]>(
      `SELECT meta_value FROM ${WP_PREFIX}usermeta WHERE user_id = ? AND meta_key = 'wp_capabilities'`,
      [user.ID]
    );
    const role = caps.length > 0 && String(caps[0].meta_value).includes('customer') ? 'customer' : 'customer';
    const id = await upsertUser(local, {
      username: user.user_login,
      email,
      role,
      createdAt: user.user_registered,
      password: null
    });
    map.set(user.ID, id);
    await saveAddress(wp, local, user.ID, id);
  }
  for (const admin of ADMINS) {
    const password = crypto.randomBytes(9).toString('base64url');
    const id = await upsertUser(local, {
      username: admin.username,
      email: admin.email,
      role: admin.role,
      createdAt: new Date(),
      password
    });
    passwords.push(`${admin.role}\t${admin.username}\t${admin.email}\t${password}`);
    const [wpUser] = await wp.query<any[]>(`SELECT ID FROM ${WP_PREFIX}users WHERE user_email = ?`, [admin.email]);
    if (wpUser.length > 0) map.set(wpUser[0].ID, id);
  }
  console.log(`  ${map.size} users`);
  return map;
}

async function upsertUser(
  local: mysql.PoolConnection,
  user: { username: string; email: string; role: string; createdAt: Date | string; password: string | null }
): Promise<number> {
  const [existing] = await local.query<any[]>(`SELECT id FROM users WHERE email = ?`, [user.email]);
  let salt: string | null = null;
  let hash: string | null = null;
  if (user.password) {
    salt = crypto.randomBytes(16).toString('hex');
    hash = hashPassword(user.password, salt);
  }
  if (existing.length > 0) {
    if (user.password) {
      await local.query(
        `UPDATE users SET username = ?, role = ?, status = 'Active', password = ?, salt = ? WHERE id = ?`,
        [user.username, user.role, hash, salt, existing[0].id]
      );
    }
    return existing[0].id;
  }
  let username = user.username;
  const [nameTaken] = await local.query<any[]>(`SELECT id FROM users WHERE username = ?`, [username]);
  if (nameTaken.length > 0) username = `${username}-${slugify(user.email).slice(0, 12)}`;
  const [res] = await local.query<any>(
    `INSERT INTO users (username, email, password, salt, status, role, notes, created_at)
     VALUES (?, ?, ?, ?, 'Active', ?, ?, ?)`,
    [username, user.email, hash, salt, user.role, user.password ? null : 'Imported from WooCommerce. Password must be reset.', user.createdAt]
  );
  return res.insertId;
}

async function saveAddress(wp: mysql.Pool, local: mysql.PoolConnection, wpUserId: number, userId: number): Promise<void> {
  const [rows] = await wp.query<any[]>(
    `SELECT meta_key, meta_value FROM ${WP_PREFIX}usermeta
     WHERE user_id = ? AND meta_key IN ('billing_first_name','billing_last_name','billing_address_1','billing_address_2','billing_city','billing_state','billing_postcode','billing_country','billing_phone')`,
    [wpUserId]
  );
  if (rows.length === 0) return;
  const meta: Record<string, string> = {};
  for (const row of rows) meta[row.meta_key] = row.meta_value || '';
  if (!meta.billing_address_1 && !meta.billing_city) return;
  const payload = {
    first_name: meta.billing_first_name || '',
    last_name: meta.billing_last_name || '',
    address_line_1: meta.billing_address_1 || '',
    address_line_2: meta.billing_address_2 || '',
    city: meta.billing_city || '',
    state: meta.billing_state || '',
    postal_code: meta.billing_postcode || '',
    country: meta.billing_country || 'LB',
    phone: meta.billing_phone || ''
  };
  const [existing] = await local.query<any[]>(
    `SELECT id FROM customer_addresses WHERE customer_id = ? AND type = 'billing' LIMIT 1`,
    [userId]
  );
  if (existing.length > 0) return;
  const encrypted = encryptionService.encrypt(payload);
  const [cols] = await local.query<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_addresses' AND COLUMN_NAME = 'content_encrypted'`
  );
  if (cols.length > 0) {
    await local.query(
      `INSERT INTO customer_addresses (customer_id, type, city, state, postal_code, country, is_default, content_encrypted, iv)
       VALUES (?, 'billing', ?, ?, ?, ?, 1, ?, ?)`,
      [userId, payload.city || 'Beirut', payload.state, payload.postal_code, payload.country, encrypted.content, encrypted.iv]
    );
  }
}

async function importPages(wp: mysql.Pool, local: mysql.PoolConnection): Promise<void> {
  console.log('Pages...');
  const slugs = [...CONTENT_PAGES];
  const [pages] = await wp.query<any[]>(
    `SELECT post_name, post_title, post_content FROM ${WP_PREFIX}posts
     WHERE post_type = 'page' AND post_status = 'publish' AND post_name IN (${slugs.map(() => '?').join(',')})`,
    slugs
  );
  for (const page of pages) {
    const content = stripShortcodes(page.post_content || '') || `<p>${page.post_title}</p>`;
    const [existing] = await local.query<any[]>(`SELECT id FROM pages WHERE slug = ?`, [page.post_name]);
    if (existing.length > 0) {
      await local.query(`UPDATE pages SET title = ?, content = ?, status = 'published' WHERE id = ?`, [page.post_title, content, existing[0].id]);
    } else {
      await local.query(
        `INSERT INTO pages (title, slug, content, status) VALUES (?, ?, ?, 'published')`,
        [page.post_title, page.post_name, content]
      );
    }
  }
  console.log(`  ${pages.length} pages`);
}

async function importMenu(local: mysql.PoolConnection): Promise<void> {
  const items = [
    ['Shop', '/our-categories'],
    ['Our Story', '/our-story'],
    ['FAQs', '/faqs'],
    ['Contact', '/contact-us'],
    ['Shipment Policy', '/shipment-policy']
  ];
  const [count] = await local.query<any[]>(`SELECT COUNT(*) AS n FROM menu`);
  if (Number(count[0].n) > 0) return;
  let order = 0;
  for (const [title, url] of items) {
    order += 1;
    await local.query(
      `INSERT INTO menu (title, url, order_index, is_visible) VALUES (?, ?, ?, 1)`,
      [title, url, order]
    );
  }
}

async function importOrders(
  wp: mysql.Pool,
  local: mysql.PoolConnection,
  productMap: Map<number, number>,
  userMap: Map<number, number>
): Promise<void> {
  console.log('Orders...');
  const [orders] = await wp.query<any[]>(
    `SELECT ID, post_status, post_date FROM ${WP_PREFIX}posts WHERE post_type = 'shop_order'`
  );
  let saved = 0;
  for (const order of orders) {
    if (SKIP_ORDER_IDS.has(order.ID)) continue;
    const number = `WC-${order.ID}`;
    const [existing] = await local.query<any[]>(`SELECT id FROM orders WHERE order_number = ?`, [number]);
    if (existing.length > 0) continue;
    const meta = await metaMap(wp, order.ID);
    const total = money(meta._order_total);
    const email = (meta._billing_email || 'guest@drinks4lessonline.local').trim();
    const status = order.post_status === 'wc-completed' ? 'completed'
      : order.post_status === 'wc-cancelled' ? 'cancelled'
      : order.post_status === 'wc-refunded' ? 'refunded'
      : 'processing';
    const address = {
      first_name: meta._shipping_first_name || meta._billing_first_name || '',
      last_name: meta._shipping_last_name || meta._billing_last_name || '',
      address_line_1: meta._shipping_address_1 || meta._billing_address_1 || '',
      city: meta._shipping_city || meta._billing_city || '',
      state: meta._shipping_state || meta._billing_state || '',
      country: meta._shipping_country || meta._billing_country || 'LB',
      phone: meta._shipping_phone || meta._billing_phone || ''
    };
    const wpUser = parseInt(meta._customer_user || '0', 10);
    const customerId = userMap.get(wpUser) ?? null;
    const [res] = await local.query<any>(
      `INSERT INTO orders (
         order_number, customer_id, customer_email, customer_phone, status,
         subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency,
         payment_method, payment_status, shipping_address, billing_address, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
      [
        number,
        customerId,
        email,
        address.phone,
        status,
        total,
        money(meta._order_tax),
        money(meta._order_shipping),
        money(meta._cart_discount),
        total,
        meta._payment_method_title || meta._payment_method || 'unknown',
        meta._date_paid ? 'paid' : status === 'cancelled' ? 'failed' : 'pending',
        JSON.stringify(address),
        JSON.stringify(address),
        order.post_date
      ]
    );
    const orderId = res.insertId;
    const [items] = await wp.query<any[]>(
      `SELECT order_item_id, order_item_name, order_item_type FROM ${WP_PREFIX}woocommerce_order_items WHERE order_id = ?`,
      [order.ID]
    );
    for (const item of items) {
      if (item.order_item_type !== 'line_item') continue;
      const [itemMeta] = await wp.query<any[]>(
        `SELECT meta_key, meta_value FROM ${WP_PREFIX}woocommerce_order_itemmeta WHERE order_item_id = ?`,
        [item.order_item_id]
      );
      const fields: Record<string, string> = {};
      for (const row of itemMeta) fields[row.meta_key] = row.meta_value ?? '';
      const productId = productMap.get(parseInt(fields._product_id || '0', 10));
      if (!productId) continue;
      const qty = Math.max(1, parseInt(fields._qty || '1', 10) || 1);
      const line = money(fields._line_total);
      await local.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, productId, item.order_item_name, qty, Math.round((line / qty) * 100) / 100, line]
      );
    }
    saved += 1;
  }
  console.log(`  ${saved} orders`);
}

async function importSettings(local: mysql.PoolConnection): Promise<void> {
  const settings: Array<[string, string]> = [
    ['siteTitle', 'Drinks4Less'],
    ['siteSlogan', 'Drinks delivered'],
    ['siteDescription', 'Drinks4Less online shop'],
    ['siteUrl', 'https://drinks4lessonline.com'],
    ['contactEmail', 'roubarizk@yahoo.com'],
    ['contactWhatsapp', '96181143065'],
    ['contactPhone', '96181143065']
  ];
  for (const [key, value] of settings) {
    await local.query(
      `INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, 'text')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
