import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.development');
dotenv.config({ path: envPath });

import { db } from '../src/config/database';
import {
  buildCategorySlugPrefix,
  buildProductSlug,
  slugify,
} from './lib/product-slug-helpers';

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  parent_slug: string | null;
};

function extractLookOrder(slug: string, sku: string | null): number | null {
  for (const value of [slug, sku ?? '']) {
    const match = value.match(/-look-(\d+)$/i) ?? value.match(/look-(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function sortProducts(products: ProductRow[]): ProductRow[] {
  return [...products].sort((a, b) => {
    const orderA = extractLookOrder(a.slug, a.sku);
    const orderB = extractLookOrder(b.slug, b.sku);
    if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
    if (orderA !== null && orderB === null) return -1;
    if (orderA === null && orderB !== null) return 1;
    return a.id - b.id;
  });
}

function resolveUniqueSlug(desired: string, used: Set<string>, productId: number): string {
  if (!used.has(desired)) return desired;
  let suffix = 2;
  while (used.has(`${desired}-${suffix}`)) suffix++;
  console.warn(`  ⚠️  Slug collision for product #${productId}: "${desired}" -> "${desired}-${suffix}"`);
  return `${desired}-${suffix}`;
}

async function fixMiscategorizedProducts(dryRun: boolean): Promise<number> {
  const [rows] = await db.query<ProductRow[]>(
    `SELECT p.id, p.sku, p.category_id, c.slug AS category_slug
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     WHERE c.slug IN ('haute-couture', 'ready-to-wear', 'bridal', 'cruise', 'accessories')`
  );
  let fixed = 0;

  for (const row of rows as unknown as Array<{ id: number; sku: string | null; category_id: number }>) {
    const match = row.sku?.match(/AC-WP-(\d+)-/);
    if (!match) continue;

    const collectionSlug = `col-${match[1]}`;
    const [cats] = await db.query<any>(
      'SELECT id FROM product_categories WHERE slug = ? LIMIT 1',
      [collectionSlug]
    );
    const collectionId = (cats as Array<{ id: number }>)[0]?.id;
    if (!collectionId || collectionId === row.category_id) continue;

    console.log(`  Fix category for #${row.id}: ${row.category_id} -> ${collectionId} (${collectionSlug})`);
    if (!dryRun) {
      await db.query('UPDATE products SET category_id = ? WHERE id = ?', [collectionId, row.id]);
    }
    fixed++;
  }

  return fixed;
}

function categorySortKey(categoryId: number | null, sample: ProductRow): string {
  const isCollection = (sample.category_slug ?? '').startsWith('col-');
  return `${isCollection ? '0' : '1'}-${String(categoryId ?? 0).padStart(6, '0')}`;
}

async function renameProductsToLooks(dryRun: boolean): Promise<void> {
  const fixed = await fixMiscategorizedProducts(dryRun);
  if (fixed > 0) {
    console.log(`${dryRun ? '[dry-run] ' : ''}Reassigned ${fixed} miscategorized product(s) to collection categories.`);
  }

  const [rows] = await db.query<ProductRow[]>(
    `SELECT p.id, p.name, p.slug, p.sku, p.category_id,
            c.name AS category_name, c.slug AS category_slug, pc.slug AS parent_slug
     FROM products p
     LEFT JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN product_categories pc ON pc.id = c.parent_id
     ORDER BY p.category_id, p.id`
  );
  const products = rows as unknown as ProductRow[];

  const byCategory = new Map<number | null, ProductRow[]>();
  for (const product of products) {
    const key = product.category_id;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(product);
  }

  const prefixByCategory = new Map<number, string>();
  for (const [categoryId, categoryProducts] of byCategory) {
    if (categoryId === null) continue;
    const sample = categoryProducts[0]!;
    if ((sample.category_slug ?? '').startsWith('col-')) {
      prefixByCategory.set(
        categoryId,
        buildCategorySlugPrefix(
          sample.category_name ?? '',
          sample.category_slug ?? '',
          sample.parent_slug,
          sample.slug
        )
      );
    }
  }

  const prefixCounts = new Map<string, number[]>();
  for (const [categoryId, prefix] of prefixByCategory) {
    if (!prefixCounts.has(prefix)) prefixCounts.set(prefix, []);
    prefixCounts.get(prefix)!.push(categoryId);
  }

  for (const [prefix, categoryIds] of prefixCounts) {
    if (categoryIds.length <= 1) continue;
    for (const categoryId of categoryIds) {
      const sample = byCategory.get(categoryId)![0]!;
      prefixByCategory.set(categoryId, `${prefix}-${sample.category_slug}`);
    }
  }

  const nameKeyToCategories = new Map<string, number[]>();
  for (const [categoryId, categoryProducts] of byCategory) {
    if (categoryId === null) continue;
    const sample = categoryProducts[0]!;
    if (!(sample.category_slug ?? '').startsWith('col-')) continue;
    const key = `${sample.parent_slug ?? ''}|${slugify(sample.category_name ?? '')}`;
    if (!nameKeyToCategories.has(key)) nameKeyToCategories.set(key, []);
    nameKeyToCategories.get(key)!.push(categoryId);
  }

  for (const categoryIds of nameKeyToCategories.values()) {
    if (categoryIds.length <= 1) continue;
    for (const categoryId of categoryIds) {
      const sample = byCategory.get(categoryId)![0]!;
      const current = prefixByCategory.get(categoryId)!;
      prefixByCategory.set(categoryId, `${current}-${sample.category_slug}`);
    }
  }

  const usedSlugs = new Set<string>();
  let updated = 0;
  let unchanged = 0;
  const pendingUpdates: Array<{ id: number; name: string; slug: string; oldName: string; oldSlug: string; categoryId: number | null }> = [];

  const sortedCategories = [...byCategory.entries()].sort((a, b) =>
    categorySortKey(a[0], a[1][0]!).localeCompare(categorySortKey(b[0], b[1][0]!))
  );

  for (const [categoryId, categoryProducts] of sortedCategories) {
    const sorted = sortProducts(categoryProducts);

    for (let i = 0; i < sorted.length; i++) {
      const product = sorted[i]!;
      const newName = `Look ${i + 1}`;
      const categoryPrefix =
        (categoryId !== null ? prefixByCategory.get(categoryId) : undefined) ??
        buildCategorySlugPrefix(
          product.category_name ?? '',
          product.category_slug ?? '',
          product.parent_slug,
          product.slug
        );
      const desiredSlug = buildProductSlug(categoryPrefix, i + 1);
      const newSlug = resolveUniqueSlug(desiredSlug, usedSlugs, product.id);
      usedSlugs.add(newSlug);

      if (product.name === newName && product.slug === newSlug) {
        unchanged++;
        continue;
      }

      console.log(
        `[cat ${categoryId ?? 'null'}] #${product.id} "${product.name}" -> "${newName}" | "${product.slug}" -> "${newSlug}"`
      );

      pendingUpdates.push({
        id: product.id,
        name: newName,
        slug: newSlug,
        oldName: product.name,
        oldSlug: product.slug,
        categoryId,
      });
      updated++;
    }
  }

  if (!dryRun && pendingUpdates.length > 0) {
    for (const update of pendingUpdates) {
      await db.query('UPDATE products SET slug = ? WHERE id = ?', [`__renaming-${update.id}`, update.id]);
    }
    for (const update of pendingUpdates) {
      await db.query('UPDATE products SET name = ?, slug = ? WHERE id = ?', [
        update.name,
        update.slug,
        update.id,
      ]);
    }
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Done. Updated: ${updated}, already correct: ${unchanged}, categories: ${byCategory.size}`
  );
}

const dryRun = process.argv.includes('--dry-run');

renameProductsToLooks(dryRun)
  .catch((error) => {
    console.error('Error renaming products:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(process.exitCode ?? 0);
  });
