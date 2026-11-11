/**
 * Fills "Header Left" / "Header Right" with the same structure the storefront
 * would show when those menus are empty: split Main Menu in half, or (if Main
 * Menu has no top-level items) mirror the category-tree fallback (up to 6 roots,
 * featured first), including second-level category links as children.
 *
 * Idempotent: clears existing items under both header roots, then re-inserts.
 */
import dotenv from 'dotenv';
import * as path from 'path';
import type { RowDataPacket } from 'mysql2/promise';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql, { type ResultSetHeader } from 'mysql2/promise';
import { dbConfig } from '../src/config/database.config';
import { MenuService, MenuItem } from '../admin/services/menuService';
import categoryService from '../src/services/categoryService';
import type { CategoryWithChildren } from '../src/services/categoryService';
import {
  STOREFRONT_HEADER_MENU_LEFT,
  STOREFRONT_HEADER_MENU_RIGHT,
  STOREFRONT_MAIN_MENU,
} from '../src/constants/storefront-nav-menus';
import { appendCustomerCareUnderHeaderRightIfMissing } from './helpers/customerCareHeaderMenu';

async function deleteSubtreeChildren(conn: mysql.PoolConnection, parentId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM menu WHERE parent_id = ?', [parentId]);
  for (const row of rows) {
    const id = Number(row.id);
    await deleteSubtreeChildren(conn, id);
    await conn.query('DELETE FROM menu WHERE id = ?', [id]);
  }
}

async function insertMenuItem(
  conn: mysql.PoolConnection,
  parentId: number,
  title: string,
  url: string,
  cssClass: string,
  isVisible: boolean,
  orderIndex: number
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, parentId, orderIndex, url, isVisible ? 1 : 0, cssClass || '']
  );
  return result.insertId;
}

async function cloneItemTree(
  conn: mysql.PoolConnection,
  parentDbId: number,
  item: MenuItem,
  siblingIndex: number
): Promise<void> {
  const orderIdx = siblingIndex * 10;
  const newId = await insertMenuItem(
    conn,
    parentDbId,
    item.title,
    (item.link || '').trim(),
    item.type || '',
    Boolean(item.active),
    orderIdx
  );
  let c = 1;
  for (const child of item.children || []) {
    await cloneItemTree(conn, newId, child, c);
    c += 1;
  }
}

function categoryTreeToMenuItems(roots: CategoryWithChildren[]): MenuItem[] {
  return roots.map((cat) => {
    const activeChildren = (cat.children || []).filter((c) => c && c.is_active !== false);
    return {
      id: '0',
      title: cat.name,
      type: 'external',
      link: `/shop/category/${cat.slug}`,
      sort: 1,
      active: true,
      children: activeChildren.map((child) => ({
        id: '0',
        title: child.name,
        type: 'external',
        link: `/shop/category/${child.slug}`,
        sort: 1,
        active: true,
        children: [],
      })),
    };
  });
}

async function run(): Promise<void> {
  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄 Migration: populate Header Left / Header Right from Main Menu or categories\n');

    const menuService = MenuService.getInstance();

    async function rootId(title: string): Promise<number | null> {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM menu WHERE parent_id IS NULL AND title = ? LIMIT 1`,
        [title]
      );
      return rows.length > 0 ? Number(rows[0].id) : null;
    }

    const mainId = await rootId(STOREFRONT_MAIN_MENU);
    const leftRootId = await rootId(STOREFRONT_HEADER_MENU_LEFT);
    const rightRootId = await rootId(STOREFRONT_HEADER_MENU_RIGHT);

    if (!leftRootId || !rightRootId) {
      throw new Error('Missing header menu roots. Run seed migration for Header Left / Header Right first.');
    }

    await deleteSubtreeChildren(conn, leftRootId);
    await deleteSubtreeChildren(conn, rightRootId);
    console.log('  ✓ Cleared existing items under header menus');

    let topLevel: MenuItem[] = [];

    if (mainId) {
      const mainMenu = await menuService.getMenuById(String(mainId));
      topLevel = (mainMenu?.items || []).filter((it) => it && it.active !== false && (it.title || '').trim() !== '');
    }

    if (topLevel.length === 0) {
      const tree = await categoryService.getCategoryTree(false);
      const rootCats = tree.filter((c) => c && c.is_active !== false);
      const featured = rootCats.filter((c) => c.is_featured);
      const ordered =
        featured.length > 0 ? featured.concat(rootCats.filter((c) => !c.is_featured)) : rootCats;
      const slice = ordered.slice(0, 6);
      topLevel = categoryTreeToMenuItems(slice);
      console.log(`  ℹ Main Menu empty or missing — built ${topLevel.length} top-level items from category tree`);
    } else {
      console.log(`  ℹ Splitting ${topLevel.length} Main Menu top-level items across header columns`);
    }

    const halfPoint = Math.ceil(topLevel.length / 2);
    const leftItems = topLevel.slice(0, halfPoint);
    const rightItems = topLevel.slice(halfPoint);

    let i = 1;
    for (const item of leftItems) {
      await cloneItemTree(conn, leftRootId, item, i);
      i += 1;
    }
    i = 1;
    for (const item of rightItems) {
      await cloneItemTree(conn, rightRootId, item, i);
      i += 1;
    }
    await appendCustomerCareUnderHeaderRightIfMissing(conn, rightRootId, rightItems.length + 1);

    console.log(`  ✓ Header Left: ${leftItems.length} top-level item(s)`);
    console.log(`  ✓ Header Right: ${rightItems.length} top-level item(s)`);
    console.log('\n✅ Done. Restart the app or wait for menu cache TTL; admin edits trigger an immediate cache reload.\n');
  } finally {
    conn.release();
    await pool.end();
  }
}

export default run;

if (require.main === module) {
  run().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}
