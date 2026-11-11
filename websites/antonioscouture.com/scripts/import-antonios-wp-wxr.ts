/**
 * Import Antonios Couture content from WordPress WXR into this CMS.
 *
 * Usage:
 *   npx ts-node scripts/import-antonios-wp-wxr.ts
 *   npx ts-node scripts/import-antonios-wp-wxr.ts --dry-run
 *   npx ts-node scripts/import-antonios-wp-wxr.ts --incremental   (skip DB wipe + wp-* downloads cleanup)
 *   npx ts-node scripts/import-antonios-wp-wxr.ts --vision   (OPENAI_API_KEY in env; slower, cost per image)
 *   npx ts-node scripts/import-antonios-wp-wxr.ts --wxr=docs/antonioscouture.WordPress.2026-04-07.xml
 *
 * Gallery images are grouped by WordPress attachment caption (content:encoded): same leading
 * look number (01, 01b, 02a → looks 1, 2) become one product with multiple images. Product names:
 * "Look 1", "Look 2", … per collection category. Slugs: {category-slug}-look-{n}
 * (e.g. haute-couture-fall-winter-2015-look-1). SKU: AC-WP-{portfolioId}-look-{n}
 * or AC-WP-{portfolioId}-{attachmentId} when no caption digits.
 *
 * By default (non-dry-run), the import performs a full reset: removes prior AC-WP products,
 * col-* categories, imported pages, relations, then deletes `public/uploads/products/wp-*` files
 * from this importer, resets logo/favicon settings to defaults, then re-imports.
 *
 * Environment: loads `.env` / `.env.<NODE_ENV>` via `setup-env` (same as `src/app.ts`) before DB config.
 */

import '../src/config/setup-env';
import * as path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import mysql from 'mysql2/promise';

import { db } from '../src/config/database';
import {
  ALLOWED_PORTFOLIO_CATEGORY_SLUGS,
  IMPORT_COLLECTION_SLUG_PREFIX,
  IMPORT_PRODUCT_SKU_PREFIX,
  PAGE_SLUGS_TO_IMPORT,
  SITE_URL_DEFAULT,
  TOP_LEVEL_CATEGORY_ORDER,
} from './lib/antonios-wp-import-constants';
import {
  buildCategorySlugPrefix,
  buildProductSlug,
  buildSoloProductSlug,
} from './lib/product-slug-helpers';
import { describeGarmentImage, visionDelayMs } from './lib/openai-vision-tags';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
const BASE_DOWNLOAD = SITE_URL_DEFAULT;

type AttachmentRecord = { url: string; file?: string; title: string; caption: string };

/** Known attachment post IDs from this export (logo-2, cropped favicon) */
const KNOWN_LOGO_ATTACHMENT_IDS = [52, 366];

function argvFlags(): { dryRun: boolean; incremental: boolean; vision: boolean; wxrPath: string } {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const incremental = argv.includes('--incremental') || argv.includes('--no-clear');
  const vision = argv.includes('--vision');
  const wxArg = argv.find((a) => a.startsWith('--wxr='));
  const wxrPath = wxArg
    ? path.resolve(process.cwd(), wxArg.slice('--wxr='.length))
    : path.join(process.cwd(), 'docs', 'antonioscouture.WordPress.2026-04-07.xml');
  return { dryRun, incremental, vision, wxrPath };
}

function textOf(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '#text' in v) return String((v as { '#text': unknown })['#text']);
  return String(v);
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * WordPress stores gallery captions in attachment post_content → WXR content:encoded.
 * Leading digits (01, 02a → 2, 9a → 9) define the look / product group.
 */
function parseLookNumberFromCaption(caption: string, attachmentTitle: string): number | null {
  const tryParse = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const m = t.match(/^0*(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1]!, 10);
    return Number.isNaN(n) ? null : n;
  };
  return tryParse(caption) ?? tryParse(attachmentTitle);
}

type ImageGroup = {
  /** Stable key: "look-3" or "solo-2552" */
  key: string;
  attachmentIds: number[];
  /** Product display suffix: caption look number, or allocated fallback */
  displayNum: number;
};

function groupKeyForAttachment(attId: number, attachmentById: Map<number, AttachmentRecord>): string {
  const rec = attachmentById.get(attId);
  const caption = rec?.caption ?? '';
  const t = rec?.title ?? '';
  const n = parseLookNumberFromCaption(caption, t);
  if (n !== null) return `look-${n}`;
  return `solo-${attId}`;
}

/** One product per caption look (leading digits); images sharing the same look are one product with multiple photos. */
function buildGalleryProductGroups(imageIds: number[], attachmentById: Map<number, AttachmentRecord>): ImageGroup[] {
  if (imageIds.length === 0) return [];

  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  for (const attId of imageIds) {
    const k = groupKeyForAttachment(attId, attachmentById);
    if (!seen.has(k)) {
      seen.add(k);
      orderedKeys.push(k);
    }
  }

  const idsByKey = new Map<string, number[]>();
  for (const k of orderedKeys) idsByKey.set(k, []);
  for (const attId of imageIds) {
    const k = groupKeyForAttachment(attId, attachmentById);
    idsByKey.get(k)!.push(attId);
  }

  let maxParsed = 0;
  for (const k of orderedKeys) {
    if (k.startsWith('look-')) {
      maxParsed = Math.max(maxParsed, parseInt(k.slice('look-'.length), 10));
    }
  }
  let nextFallback = maxParsed + 1;

  return orderedKeys.map((key) => {
    let displayNum: number;
    if (key.startsWith('look-')) {
      displayNum = parseInt(key.slice('look-'.length), 10);
    } else {
      displayNum = nextFallback++;
    }
    return { key, attachmentIds: idsByKey.get(key)!, displayNum };
  });
}

function extractIdsFromPhpSerialized(s: string): number[] {
  const ids: number[] = [];
  const re = /s:\d+:"(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseInt(m[1]!, 10);
    if (!Number.isNaN(n)) ids.push(n);
  }
  return ids;
}

function stripWpShortcodes(raw: string): string {
  return raw.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeContentHtml(html: string): string {
  let s = html;
  s = s.replace(/http:\/\/antonioscouture\.com\/version2\/wp-content\//gi, 'https://antonioscouture.com/wp-content/');
  s = s.replace(/http:\/\/antonioscouture\.com\/wp-content\//gi, 'https://antonioscouture.com/wp-content/');
  return s;
}

function getPostMeta(item: Record<string, unknown>): Array<{ key: string; value: string }> {
  const raw = item['wp:postmeta'];
  return asArray(raw).map((p) => ({
    key: textOf((p as Record<string, unknown>)['wp:meta_key']),
    value: textOf((p as Record<string, unknown>)['wp:meta_value']),
  }));
}

function metaMap(meta: Array<{ key: string; value: string }>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const { key, value } of meta) {
    if (key) o[key] = value;
  }
  return o;
}

function postType(item: Record<string, unknown>): string {
  return textOf(item['wp:post_type']);
}

function postId(item: Record<string, unknown>): number {
  return parseInt(textOf(item['wp:post_id']), 10);
}

function postStatus(item: Record<string, unknown>): string {
  return textOf(item['wp:status']);
}

function postSlug(item: Record<string, unknown>): string {
  return textOf(item['wp:post_name']);
}

function postTitle(item: Record<string, unknown>): string {
  return textOf(item.title);
}

function contentEncoded(item: Record<string, unknown>): string {
  return textOf(item['content:encoded']);
}

function catDomain(c: unknown): string {
  if (typeof c !== 'object' || c === null) return '';
  const o = c as Record<string, unknown>;
  return String(o['@_domain'] ?? o.domain ?? '');
}

function catNicename(c: unknown): string {
  if (typeof c !== 'object' || c === null) return '';
  const o = c as Record<string, unknown>;
  return String(o['@_nicename'] ?? o.nicename ?? '');
}

function getPortfolioCategorySlug(item: Record<string, unknown>, termIdToSlug: Map<number, string>): string | null {
  const cats = asArray(item.category).filter((c) => catDomain(c) === 'portfolio_category');
  for (const c of cats) {
    const slug = catNicename(c);
    if (slug && ALLOWED_PORTFOLIO_CATEGORY_SLUGS.has(slug)) return slug;
  }
  const meta = metaMap(getPostMeta(item));
  const termIdRaw = meta['portfolio_category'];
  if (termIdRaw) {
    const tid = parseInt(termIdRaw, 10);
    if (!Number.isNaN(tid)) {
      const s = termIdToSlug.get(tid);
      if (s && ALLOWED_PORTFOLIO_CATEGORY_SLUGS.has(s)) return s;
    }
  }
  return null;
}

interface WpTermRow {
  termId: number;
  taxonomy: string;
  slug: string;
  parentSlug: string;
  name: string;
}

function parseChannelTerms(channel: Record<string, unknown>): WpTermRow[] {
  const terms = asArray(channel['wp:term'] as unknown);
  const out: WpTermRow[] = [];
  for (const t of terms) {
    const tr = t as Record<string, unknown>;
    const taxonomy = textOf(tr['wp:term_taxonomy']);
    if (taxonomy !== 'portfolio_category') continue;
    const slug = textOf(tr['wp:term_slug']);
    if (!ALLOWED_PORTFOLIO_CATEGORY_SLUGS.has(slug)) continue;
    out.push({
      termId: parseInt(textOf(tr['wp:term_id']), 10),
      taxonomy,
      slug,
      parentSlug: textOf(tr['wp:term_parent']),
      name: textOf(tr['wp:term_name']),
    });
  }
  return out;
}

function buildTermIdToSlug(terms: WpTermRow[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of terms) m.set(t.termId, t.slug);
  return m;
}

async function downloadToFile(url: string, destPath: string): Promise<boolean> {
  await fse.ensureDir(path.dirname(destPath));
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    await fs.promises.writeFile(destPath, Buffer.from(res.data));
    return true;
  } catch (e) {
    console.warn(`  ⚠️  Download failed ${url}:`, (e as Error).message);
    return false;
  }
}

async function saveSiteSetting(conn: mysql.PoolConnection, key: string, value: unknown): Promise<void> {
  const settingType = typeof value;
  const settingValue = settingType === 'string' ? (value as string) : JSON.stringify(value);
  const [result] = await conn.query(
    `UPDATE site_settings SET setting_value = ?, setting_type = ? WHERE setting_key = ?`,
    [settingValue, settingType, key]
  );
  if ((result as mysql.ResultSetHeader).affectedRows === 0) {
    await conn.query(`INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)`, [
      key,
      settingValue,
      settingType,
    ]);
  }
}

async function runClear(conn: mysql.PoolConnection): Promise<void> {
  console.log('\n🧹 Full reset: DB import artifacts + downloaded wp-* files…');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(
    `DELETE pcr FROM product_category_relations pcr
     INNER JOIN products p ON p.id = pcr.product_id WHERE p.sku LIKE ?`,
    [`${IMPORT_PRODUCT_SKU_PREFIX}%`]
  );
  await conn.query(
    `DELETE pi FROM product_images pi
     INNER JOIN products p ON pi.product_id = p.id WHERE p.sku LIKE ?`,
    [`${IMPORT_PRODUCT_SKU_PREFIX}%`]
  );
  await conn.query(`DELETE FROM products WHERE sku LIKE ?`, [`${IMPORT_PRODUCT_SKU_PREFIX}%`]);
  await conn.query(`DELETE FROM product_categories WHERE slug LIKE ?`, [`${IMPORT_COLLECTION_SLUG_PREFIX}%`]);
  const pageList = [...PAGE_SLUGS_TO_IMPORT];
  await conn.query(`DELETE FROM pages WHERE slug IN (${pageList.map(() => '?').join(',')})`, pageList);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  await saveSiteSetting(conn, 'logo', '/images/logo.jpg');
  await saveSiteSetting(conn, 'favicon', '/images/favicon.ico');

  await deleteAntoniosWpDownloadedFiles();

  console.log('   ✅ Reset done\n');
}

/** Files saved by this importer as `wp-{attachmentId}.{ext}` under public/uploads/products */
async function deleteAntoniosWpDownloadedFiles(): Promise<void> {
  if (!(await fse.pathExists(UPLOAD_DIR))) return;
  const names = await fs.promises.readdir(UPLOAD_DIR);
  let removed = 0;
  for (const name of names) {
    if (!/^wp-\d+\./i.test(name)) continue;
    try {
      await fs.promises.unlink(path.join(UPLOAD_DIR, name));
      removed++;
    } catch {
      /* ignore */
    }
  }
  if (removed > 0) {
    console.log(`   ✅ Removed ${removed} file(s) matching wp-* from ${UPLOAD_DIR}`);
  }
}

/** Shop code expects this table; create it if migrations were never applied. */
async function ensureProductCategoryRelationsTable(conn: mysql.PoolConnection): Promise<void> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'product_category_relations'`
  );
  if (rows[0] && Number(rows[0]['c']) > 0) return;

  console.log('   ℹ️  Creating product_category_relations (not found in database)');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS product_category_relations (
      product_id INT NOT NULL,
      category_id INT NOT NULL,
      PRIMARY KEY (product_id, category_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    INSERT IGNORE INTO product_category_relations (product_id, category_id)
    SELECT id, category_id FROM products WHERE category_id IS NOT NULL
  `);
}

async function upsertCategory(
  conn: mysql.PoolConnection,
  name: string,
  slug: string,
  parentId: number | null,
  orderIndex: number
): Promise<number> {
  await conn.query(
    `INSERT INTO product_categories (name, slug, description, parent_id, is_featured, order_index, is_active)
     VALUES (?, ?, NULL, ?, 0, ?, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), parent_id = VALUES(parent_id), order_index = VALUES(order_index), is_active = 1`,
    [name, slug, parentId, orderIndex]
  );
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT id FROM product_categories WHERE slug = ? LIMIT 1',
    [slug]
  );
  return rows[0]!['id'] as number;
}

/** Build list of category id + descendants (self first for stable ordering). */
function collectDescendantCategoryIds(
  rootId: number,
  childrenOf: Map<number | null, number[]>
): number[] {
  const out: number[] = [];
  const walk = (id: number) => {
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) walk(c);
  };
  walk(rootId);
  return out;
}

/**
 * Set product_categories.image_url from the first product in the category subtree
 * (category_id or product_category_relations), using that product's primary/first image.
 */
async function assignCategoryImagesFromFirstProduct(conn: mysql.PoolConnection): Promise<number> {
  const [allCats] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, parent_id FROM product_categories WHERE is_active = 1`
  );
  const childrenOf = new Map<number | null, number[]>();
  for (const c of allCats) {
    const raw = c['parent_id'];
    const parentKey = raw === null || raw === undefined ? null : (raw as number);
    const id = c['id'] as number;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(id);
  }

  const [catRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id FROM product_categories WHERE is_active = 1 ORDER BY id ASC`
  );
  let updated = 0;

  for (const row of catRows) {
    const catId = row['id'] as number;
    const scopeIds = collectDescendantCategoryIds(catId, childrenOf);
    if (scopeIds.length === 0) continue;

    const placeholders = scopeIds.map(() => '?').join(',');
    const params = [...scopeIds, ...scopeIds];
    const [pRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT p.id
       FROM products p
       WHERE p.is_active = 1 AND p.status = 'published'
         AND (
           p.category_id IN (${placeholders})
           OR EXISTS (
             SELECT 1 FROM product_category_relations pcr
             WHERE pcr.product_id = p.id AND pcr.category_id IN (${placeholders})
           )
         )
       ORDER BY p.id ASC
       LIMIT 1`,
      params
    );
    if (pRows.length === 0) continue;

    const productId = pRows[0]!['id'] as number;
    const [imgRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT image_url FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, order_index ASC, id ASC
       LIMIT 1`,
      [productId]
    );
    if (imgRows.length === 0) continue;
    const imageUrl = String(imgRows[0]!['image_url'] ?? '').trim();
    if (!imageUrl) continue;

    await conn.query(
      `UPDATE product_categories SET image_url = ?, thumb_url = NULL WHERE id = ?`,
      [imageUrl, catId]
    );
    updated++;
  }

  return updated;
}

async function main(): Promise<void> {
  const { dryRun, incremental, vision, wxrPath } = argvFlags();
  const fullReset = !dryRun && !incremental;
  if (!fs.existsSync(wxrPath)) {
    console.error(`WXR not found: ${wxrPath}`);
    process.exit(1);
  }

  console.log(
    `📦 Antonios WXR import${dryRun ? ' (DRY RUN)' : ''}${!dryRun && fullReset ? ' (full reset + re-download)' : ''}${!dryRun && incremental ? ' (incremental)' : ''}${!dryRun && vision ? ' + OpenAI vision' : ''}`
  );
  console.log(`   File: ${wxrPath}`);

  const xml = fs.readFileSync(wxrPath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    htmlEntities: true,
    isArray: (name) =>
      ['item', 'wp:postmeta', 'wp:category', 'wp:tag', 'wp:term', 'wp:author', 'category'].includes(name),
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const channel = (doc.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  if (!channel) {
    console.error('Invalid WXR: missing rss.channel');
    process.exit(1);
  }

  const channelTitle = textOf(channel.title);
  const channelLink = textOf(channel.link);

  const items = asArray(channel.item as unknown) as Record<string, unknown>[];
  const wpTerms = parseChannelTerms(channel);
  const termIdToSlug = buildTermIdToSlug(wpTerms);

  const attachmentById = new Map<number, AttachmentRecord>();
  const portfolioItems: Record<string, unknown>[] = [];
  const pageItems: Record<string, unknown>[] = [];
  const attachmentItems: Record<string, unknown>[] = [];

  for (const item of items) {
    const pt = postType(item);
    if (pt === 'attachment') {
      attachmentItems.push(item);
      const id = postId(item);
      const meta = metaMap(getPostMeta(item));
      const url = textOf(item['wp:attachment_url']);
      const file = meta['_wp_attached_file'];
      const caption = contentEncoded(item).trim();
      attachmentById.set(id, { url, file, title: postTitle(item), caption });
    } else if (pt === 'portfolio' && postStatus(item) === 'publish') {
      portfolioItems.push(item);
    } else if (pt === 'page' && postStatus(item) === 'publish') {
      pageItems.push(item);
    }
  }

  const allowedAttachmentIds = new Set<number>();

  function resolveAttachmentUrl(attId: number): string | null {
    const rec = attachmentById.get(attId);
    if (!rec) return null;
    if (rec.url && rec.url.startsWith('http')) return rec.url;
    if (rec.file) return `${BASE_DOWNLOAD}/wp-content/uploads/${rec.file.replace(/^\/+/, '')}`;
    return null;
  }

  for (const item of portfolioItems) {
    const meta = metaMap(getPostMeta(item));
    const gal = meta['village_gallery'];
    if (gal) {
      for (const id of extractIdsFromPhpSerialized(gal)) allowedAttachmentIds.add(id);
    }
    const th = meta['_thumbnail_id'];
    if (th) {
      const tid = parseInt(th, 10);
      if (!Number.isNaN(tid)) allowedAttachmentIds.add(tid);
    }
  }

  for (const id of KNOWN_LOGO_ATTACHMENT_IDS) allowedAttachmentIds.add(id);

  for (const item of attachmentItems) {
    const slug = postSlug(item).toLowerCase();
    if (slug === 'logo-2' || slug === 'cropped-fav2-jpg') {
      allowedAttachmentIds.add(postId(item));
    }
  }

  console.log(`   Portfolio posts: ${portfolioItems.length}`);
  console.log(`   Allowed attachments: ${allowedAttachmentIds.size}`);

  if (dryRun) {
    for (const item of portfolioItems) {
      const pid = postId(item);
      const title = postTitle(item);
      const baseSlug = postSlug(item) || `portfolio-${pid}`;
      const parentSlug = getPortfolioCategorySlug(item, termIdToSlug);
      const meta = metaMap(getPostMeta(item));
      const galleryIds = meta['village_gallery'] ? extractIdsFromPhpSerialized(meta['village_gallery']) : [];
      const th = meta['_thumbnail_id'] ? parseInt(meta['_thumbnail_id'], 10) : NaN;
      const imageIds: number[] = [];
      const seenDr = new Set<number>();
      for (const id of galleryIds) {
        if (!seenDr.has(id)) {
          seenDr.add(id);
          imageIds.push(id);
        }
      }
      if (!Number.isNaN(th) && !seenDr.has(th)) {
        imageIds.unshift(th);
        seenDr.add(th);
      }
      const nProd = buildGalleryProductGroups(imageIds, attachmentById).length;
      console.log(
        `   [dry-run] "${title}" → ~${nProd} product(s) (caption-grouped, ${imageIds.length} image slot(s)) parent=${
          parentSlug ?? '?'
        } collection_slug=${baseSlug}`
      );
    }
    for (const item of pageItems) {
      const slug = postSlug(item);
      if (!PAGE_SLUGS_TO_IMPORT.has(slug)) continue;
      console.log(`   [dry-run] Page /${slug}/ (${postTitle(item)})`);
    }
    if (vision) {
      console.log(
        `   [dry-run] --vision: would call OpenAI for each image (needs OPENAI_API_KEY; use VISION_DELAY_MS to throttle).`
      );
    }
    console.log('\n✅ Dry run finished (no DB or downloads).\n');
    return;
  }

  const pool = db.getPool();
  const conn = await pool.getConnection();
  try {
    await ensureProductCategoryRelationsTable(conn);
    if (fullReset) {
      await runClear(conn);
    }

    await fse.ensureDir(UPLOAD_DIR);

    const enrichVision = vision && !!process.env.OPENAI_API_KEY;
    if (vision && !process.env.OPENAI_API_KEY) {
      console.warn('   ⚠️  --vision was passed but OPENAI_API_KEY is not set; skipping vision enrichment.\n');
    }
    if (enrichVision) {
      console.log(
        `   🤖 Vision: OpenAI model ${process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'}, delay ${visionDelayMs()}ms between images\n`
      );
    }

    const categoryIdBySlug = new Map<string, number>();

    function orderForTopLevel(slug: string): number {
      const idx = TOP_LEVEL_CATEGORY_ORDER.indexOf(slug);
      return idx >= 0 ? idx * 10 : 500 + Math.abs(slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 1000);
    }

    const childrenOfAccessories = ['fashion-jewelry', 'fine-jewelry', 'hand-bags', 'shoes'];

    const parents = wpTerms.filter((t) => !t.parentSlug);
    parents.sort((a, b) => orderForTopLevel(a.slug) - orderForTopLevel(b.slug));
    for (const t of parents) {
      const id = await upsertCategory(conn, t.name, t.slug, null, orderForTopLevel(t.slug));
      categoryIdBySlug.set(t.slug, id);
    }

    const children = wpTerms.filter((t) => t.parentSlug);
    children.sort((a, b) => {
      if (a.parentSlug === 'accessories' && b.parentSlug === 'accessories') {
        return childrenOfAccessories.indexOf(a.slug) - childrenOfAccessories.indexOf(b.slug);
      }
      return a.slug.localeCompare(b.slug);
    });
    for (const t of children) {
      const pid = categoryIdBySlug.get(t.parentSlug);
      if (!pid) {
        console.warn(`  ⚠️  Skip term ${t.slug}: parent ${t.parentSlug} missing`);
        continue;
      }
      const ord =
        t.parentSlug === 'accessories' ? Math.max(0, childrenOfAccessories.indexOf(t.slug)) * 5 : 0;
      const id = await upsertCategory(conn, t.name, t.slug, pid, ord);
      categoryIdBySlug.set(t.slug, id);
    }

    async function importAttachment(attId: number): Promise<string | null> {
      if (!allowedAttachmentIds.has(attId)) return null;
      const srcUrl = resolveAttachmentUrl(attId);
      if (!srcUrl) return null;
      let pathname = '';
      try {
        pathname = new URL(srcUrl).pathname;
      } catch {
        return null;
      }
      const ext = path.extname(pathname) || '.jpg';
      const safeExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : '.jpg';
      const fileName = `wp-${attId}${safeExt}`;
      const destAbs = path.join(UPLOAD_DIR, fileName);
      const publicPath = `/uploads/products/${fileName}`;
      const ok = await downloadToFile(srcUrl, destAbs);
      if (!ok) return null;
      return publicPath;
    }

    for (const item of portfolioItems) {
      const pid = postId(item);
      const title = postTitle(item);
      const baseSlug = postSlug(item) || `portfolio-${pid}`;
      const parentSlug = getPortfolioCategorySlug(item, termIdToSlug);
      if (!parentSlug) {
        console.warn(`  ⚠️  Skip portfolio ${pid} (${title}): no whitelisted category`);
        continue;
      }

      let parentCatId = categoryIdBySlug.get(parentSlug);
      if (parentCatId === undefined || parentCatId === null) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
          'SELECT id FROM product_categories WHERE slug = ? LIMIT 1',
          [parentSlug]
        );
        parentCatId = rows[0]?.['id'] as number | undefined;
        if (parentCatId !== undefined) categoryIdBySlug.set(parentSlug, parentCatId);
      }
      if (parentCatId === undefined) {
        console.warn(`  ⚠️  Skip portfolio ${pid}: parent slug ${parentSlug} not in DB`);
        continue;
      }

      const collSlug = `${IMPORT_COLLECTION_SLUG_PREFIX}${pid}`;
      const menuOrder = parseInt(textOf(item['wp:menu_order']), 10) || 0;

      let collectionCatId = parentCatId;
      collectionCatId = await upsertCategory(conn, title, collSlug, parentCatId, menuOrder);
      categoryIdBySlug.set(collSlug, collectionCatId);

      const meta = metaMap(getPostMeta(item));
      const galleryIds = meta['village_gallery'] ? extractIdsFromPhpSerialized(meta['village_gallery']) : [];
      const thumbId = meta['_thumbnail_id'] ? parseInt(meta['_thumbnail_id'], 10) : NaN;
      const imageIds: number[] = [];
      const seen = new Set<number>();
      for (const id of galleryIds) {
        if (!seen.has(id)) {
          seen.add(id);
          imageIds.push(id);
        }
      }
      if (!Number.isNaN(thumbId) && !seen.has(thumbId)) {
        imageIds.unshift(thumbId);
        seen.add(thumbId);
      }

      if (imageIds.length === 0) {
        console.warn(`  ⚠️  Skip portfolio ${pid} (${title}): no images`);
        continue;
      }

      const groups = buildGalleryProductGroups(imageIds, attachmentById);
      const categorySlugPrefix = buildCategorySlugPrefix(title, collSlug, parentSlug);

      let created = 0;
      let lookIndex = 0;
      for (const g of groups) {
        lookIndex++;
        const productName = `Look ${lookIndex}`;
        const firstAtt = g.attachmentIds[0]!;
        const sku = g.key.startsWith('look-')
          ? `${IMPORT_PRODUCT_SKU_PREFIX}${pid}-look-${g.displayNum}`
          : `${IMPORT_PRODUCT_SKU_PREFIX}${pid}-${firstAtt}`;
        const productSlug = g.key.startsWith('look-')
          ? buildProductSlug(categorySlugPrefix, lookIndex)
          : buildSoloProductSlug(categorySlugPrefix, firstAtt);

        const downloaded: Array<{ attId: number; imgPath: string }> = [];
        for (const attId of g.attachmentIds) {
          const imgPath = await importAttachment(attId);
          if (!imgPath) {
            console.warn(`  ⚠️  Skip image ${attId} for portfolio ${pid} group ${g.key} (download/url)`);
            continue;
          }
          downloaded.push({ attId, imgPath });
        }
        if (downloaded.length === 0) {
          console.warn(`  ⚠️  Skip product group ${g.key} for portfolio ${pid} (no images downloaded)`);
          continue;
        }

        const shortDesc = `WordPress portfolio #${pid}; media: ${g.attachmentIds.join(', ')}.`;

        let metaDesc: string | null = null;
        let metaKw: string | null = null;
        if (enrichVision) {
          const primaryLocal = path.join(UPLOAD_DIR, path.basename(downloaded[0]!.imgPath));
          const tags = await describeGarmentImage(primaryLocal, process.env.OPENAI_API_KEY!);
          if (tags) {
            metaDesc = tags.description || null;
            metaKw = tags.keywords || null;
          }
          const delayMs = visionDelayMs();
          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }

        await conn.query(
          `INSERT INTO products (
          name, slug, sku, short_description, description, price, stock_quantity, track_inventory,
          is_featured, is_active, status, category_id, brand_id, meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, NULL, 0, 0, 0, 0, 1, 'published', ?, NULL, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), category_id = VALUES(category_id), short_description = VALUES(short_description), meta_description = VALUES(meta_description), meta_keywords = VALUES(meta_keywords), is_active = 1, status = 'published'`,
          [productName, productSlug, sku, shortDesc, collectionCatId, metaDesc, metaKw]
        );
        const [pRows] = await conn.query<mysql.RowDataPacket[]>(`SELECT id FROM products WHERE sku = ? LIMIT 1`, [sku]);
        const productId = pRows[0]!['id'] as number;

        await conn.query(`DELETE FROM product_category_relations WHERE product_id = ?`, [productId]);
        await conn.query(`INSERT INTO product_category_relations (product_id, category_id) VALUES (?, ?), (?, ?)`, [
          productId,
          parentCatId!,
          productId,
          collectionCatId,
        ]);

        await conn.query(`DELETE FROM product_images WHERE product_id = ?`, [productId]);
        for (let i = 0; i < downloaded.length; i++) {
          const { imgPath } = downloaded[i]!;
          await conn.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, order_index, is_primary) VALUES (?, ?, ?, ?, ?)`,
            [productId, imgPath, productName, i, i === 0 ? 1 : 0]
          );
        }
        created++;
      }
      console.log(
        `   ✅ Portfolio ${pid} "${title}" → ${created} product(s), ${imageIds.length} gallery image(s) (caption-grouped)`
      );
    }

    const categoryImagesSet = await assignCategoryImagesFromFirstProduct(conn);
    console.log(`   ✅ Category images: ${categoryImagesSet} category/collection tiles set from first product photo`);

    for (const item of pageItems) {
      const slug = postSlug(item);
      if (!PAGE_SLUGS_TO_IMPORT.has(slug)) continue;
      const title = postTitle(item);
      const raw = contentEncoded(item);
      const html = normalizeContentHtml(stripWpShortcodes(raw));
      const order = parseInt(textOf(item['wp:menu_order']), 10) || 0;

      await conn.query(
        `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index)
         VALUES (?, ?, ?, '', '', 'published', 'inner', NULL, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), order_index = VALUES(order_index), status = 'published'`,
        [title, slug, html, order]
      );
      console.log(`   ✅ Page /${slug}/`);
    }

    const [existingNe] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM pages WHERE slug = 'news-events' LIMIT 1`
    );
    if (existingNe.length === 0) {
      await conn.query(
        `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index)
         VALUES (?, 'news-events', ?, '', '', 'published', 'inner', NULL, ?)`,
        [
          'News & Events',
          '<p>News and announcements from Antonios Couture. Use the admin CMS to add content — the WordPress export did not include a standalone page for this URL.</p>',
          11,
        ]
      );
      console.log('   ✅ Page /news-events/ (stub — no page CPT in WXR)');
    }

    await saveSiteSetting(conn, 'siteTitle', channelTitle || 'Antonios Couture');
    await saveSiteSetting(conn, 'siteUrl', channelLink || SITE_URL_DEFAULT);
    await saveSiteSetting(conn, 'siteDescription', '');
    await saveSiteSetting(conn, 'seo', {
      defaultTitle: channelTitle || 'Antonios Couture',
      defaultDescription:
        'Antonios Couture — Haute couture, ready-to-wear, bridal, cruise, accessories, and bespoke bridal.',
      defaultKeywords: 'Antonios Couture, fashion, haute couture, bridal, Beirut, couture',
    });

    const authors = asArray(channel['wp:author'] as unknown);
    const emails = authors
      .map((a) => textOf((a as Record<string, unknown>)['wp:author_email']))
      .filter(Boolean);
    const primaryEmail = emails.find((e) => /gnatanios|antonioscouture/i.test(e)) || emails[0] || '';
    await saveSiteSetting(conn, 'contactEmail', primaryEmail);
    await saveSiteSetting(conn, 'contactPhone', '');
    await saveSiteSetting(conn, 'address', '');

    let logoPath: string | null = null;
    let favPath: string | null = null;
    const logoId = KNOWN_LOGO_ATTACHMENT_IDS[0]!;
    const favId = KNOWN_LOGO_ATTACHMENT_IDS[1]!;
    if (logoId) logoPath = await importAttachment(logoId);
    if (favId) favPath = await importAttachment(favId);
    if (logoPath) await saveSiteSetting(conn, 'logo', logoPath);
    if (favPath) await saveSiteSetting(conn, 'favicon', favPath);

    console.log('   ✅ site_settings updated');

    console.log('\n✅ Import finished.\n');
  } finally {
    conn.release();
  }
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
