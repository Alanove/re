/**
 * Disable New Arrivals + Shop The Look homepage blocks; seed two fullscreen
 * category sections and one Couture rail (replaces New Arrivals visually).
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

interface BlockRow {
  id: number;
  type: string;
  sort_order: number;
  is_enabled: number | boolean;
  config: string | Record<string, unknown>;
}

function parseConfig(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (raw || {}) as Record<string, unknown>;
}

async function run(): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    console.log('\n🔄 Migration: homepage fullscreen sections + couture rail\n');

    const [rows] = await db.query(
      `SELECT id, type, sort_order, is_enabled, config FROM home_page_blocks ORDER BY sort_order ASC, id ASC`
    );
    const blocks = (rows as BlockRow[]) || [];

    const shopLookCategoryIds: number[] = [];
    for (const block of blocks) {
      const cfg = parseConfig(block.config);
      if (block.type === 'products_list' && Boolean(block.is_enabled)) {
        await db.execute(`UPDATE home_page_blocks SET is_enabled = 0 WHERE id = ?`, [block.id]);
        console.log(`  ✓ Disabled products_list #${block.id}`);
      }
      if (
        block.type === 'category_display' &&
        cfg.displayMode === 'shop_the_look' &&
        Boolean(block.is_enabled)
      ) {
        await db.execute(`UPDATE home_page_blocks SET is_enabled = 0 WHERE id = ?`, [block.id]);
        console.log(`  ✓ Disabled shop_the_look #${block.id}`);
        const catId = cfg.categoryId != null ? Number(cfg.categoryId) : NaN;
        if (Number.isFinite(catId) && catId > 0 && !shopLookCategoryIds.includes(catId)) {
          shopLookCategoryIds.push(catId);
        }
      }
    }

    const [existingFullscreen] = await db.query(
      `SELECT id, config FROM home_page_blocks WHERE type = 'category_display'`
    );
    let hasFullscreen = false;
    for (const row of (existingFullscreen as { id: number; config: string | Record<string, unknown> }[]) || []) {
      const cfg = parseConfig(row.config);
      if (cfg.displayMode === 'fullscreen') {
        hasFullscreen = true;
        break;
      }
    }

    const [existingRail] = await db.query(
      `SELECT id, config FROM home_page_blocks WHERE type = 'products_list'`
    );
    let hasRail = false;
    for (const row of (existingRail as { id: number; config: string | Record<string, unknown> }[]) || []) {
      const cfg = parseConfig(row.config);
      if (cfg.layout === 'couture_rail') {
        hasRail = true;
        break;
      }
    }

    let seedCategoryIds = shopLookCategoryIds.slice(0, 2);
    if (seedCategoryIds.length < 2) {
      const [featured] = await db.query(
        `SELECT id FROM product_categories
         WHERE is_active = 1 AND is_featured = 1
         ORDER BY order_index ASC, name ASC
         LIMIT 4`
      );
      for (const cat of (featured as { id: number }[]) || []) {
        if (seedCategoryIds.length >= 2) break;
        if (!seedCategoryIds.includes(cat.id)) seedCategoryIds.push(cat.id);
      }
    }
    if (seedCategoryIds.length < 2) {
      const [roots] = await db.query(
        `SELECT id FROM product_categories
         WHERE is_active = 1 AND parent_id IS NULL
         ORDER BY order_index ASC, name ASC
         LIMIT 4`
      );
      for (const cat of (roots as { id: number }[]) || []) {
        if (seedCategoryIds.length >= 2) break;
        if (!seedCategoryIds.includes(cat.id)) seedCategoryIds.push(cat.id);
      }
    }

    let hauteCoutureId: number | null = null;
    const [hcRows] = await db.query(
      `SELECT id FROM product_categories WHERE slug = 'haute-couture' AND is_active = 1 LIMIT 1`
    );
    hauteCoutureId = (hcRows as { id: number }[])?.[0]?.id ?? null;

    const [maxRows] = await db.query(
      `SELECT MAX(sort_order) AS maxOrder FROM home_page_blocks`
    );
    let sortOrder = Number((maxRows as { maxOrder: number | null }[])?.[0]?.maxOrder ?? -1) + 1;

    // Prefer inserting new sections near the top: after any tagline (default text), before La Maison
    const [laMaisonRows] = await db.query(
      `SELECT id, sort_order, config FROM home_page_blocks WHERE type = 'text'`
    );
    let insertAt = 0;
    for (const row of (laMaisonRows as BlockRow[]) || []) {
      const cfg = parseConfig(row.config);
      if (cfg.style === 'la_maison') {
        insertAt = Number(row.sort_order);
        break;
      }
      if (cfg.style !== 'la_maison') {
        insertAt = Number(row.sort_order) + 1;
      }
    }

    async function insertBlock(
      type: string,
      config: Record<string, unknown>,
      atOrder: number
    ): Promise<void> {
      await db.execute(
        `UPDATE home_page_blocks SET sort_order = sort_order + 1 WHERE sort_order >= ?`,
        [atOrder]
      );
      await db.execute(
        `INSERT INTO home_page_blocks (type, sort_order, is_enabled, config) VALUES (?, ?, 1, ?)`,
        [type, atOrder, JSON.stringify(config)]
      );
    }

    if (!hasFullscreen && seedCategoryIds.length > 0) {
      let orderCursor = insertAt;
      for (const catId of seedCategoryIds.slice(0, 2)) {
        await insertBlock(
          'category_display',
          {
            categoryId: catId,
            displayMode: 'fullscreen',
            introHtml: ''
          },
          orderCursor
        );
        console.log(`  ✓ Inserted fullscreen category_display for category #${catId} at order ${orderCursor}`);
        orderCursor += 1;
      }
      insertAt = orderCursor;
    } else if (hasFullscreen) {
      console.log('  ⚠️  Fullscreen blocks already present — skip insert');
    } else {
      console.log('  ⚠️  No categories available to seed fullscreen blocks');
    }

    if (!hasRail) {
      const railConfig: Record<string, unknown> = {
        title: '',
        discoverLink: hauteCoutureId ? '/shop/category/haute-couture' : '/shop',
        source: hauteCoutureId ? 'category' : 'featured',
        categoryId: hauteCoutureId,
        limit: 4,
        layout: 'couture_rail'
      };
      await insertBlock('products_list', railConfig, insertAt);
      console.log(`  ✓ Inserted couture_rail products_list at order ${insertAt}`);
    } else {
      console.log('  ⚠️  Couture rail already present — skip insert');
    }

    // Silence unused if no inserts used falling max sortOrder
    void sortOrder;

    console.log('\n✅ Migration completed successfully!\n');
    return { success: true, message: 'Homepage fullscreen + couture rail seeded' };
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return { success: false, message: 'Migration failed', error: error.message };
  }
}

export default run;
