/**
 * Drops legacy property/accounting tables and renames e-commerce payment rows table.
 *
 * - Removes: apartment_payments, ledger_transactions, apartments, payments (condo billing),
 *   projects, transaction_categories, accounts
 * - Renames: transactions → payment_transactions when the table is the e-commerce shape (order_id)
 * - If `data/projects-portfolio.json` does not exist yet, exports rows from `projects` before drop.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

function parseJsonField(value: unknown, defaultVal: any[] = []): any[] {
  if (value == null) return defaultVal;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultVal;
    }
  }
  return defaultVal;
}

async function exportProjectsIfNeeded(): Promise<void> {
  const storePath = path.resolve(process.cwd(), 'data', 'projects-portfolio.json');
  if (fs.existsSync(storePath)) return;

  const [tables] = await db.query<any[]>("SHOW TABLES LIKE 'projects'");
  if (!tables || (tables as any[]).length === 0) return;

  const [rows] = await db.query<any[]>('SELECT * FROM projects ORDER BY id');
  if (!rows || !(rows as any[]).length) return;

  const projects = (rows as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description || '',
    content: r.content || '',
    country: r.country || '',
    city: r.city || '',
    year: r.year,
    category: r.category || '',
    client: r.client || '',
    featuredImage: r.featured_image || '',
    images: parseJsonField(r.images, []),
    tags: parseJsonField(r.tags, []),
    status: r.status || 'published',
    orderIndex: r.order_index ?? 0,
    createdAt: r.created_at
      ? new Date(r.created_at).toISOString()
      : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  }));

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify({ projects }, null, 2), 'utf-8');
  console.log(`  ✓ Exported ${projects.length} project(s) to data/projects-portfolio.json`);
}

export default async function run(): Promise<void> {
  await exportProjectsIfNeeded();

  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await db.query('DROP TABLE IF EXISTS apartment_payments');
    await db.query('DROP TABLE IF EXISTS ledger_transactions');
    await db.query('DROP TABLE IF EXISTS apartments');
    await db.query('DROP TABLE IF EXISTS payments');
    await db.query('DROP TABLE IF EXISTS projects');
    await db.query('DROP TABLE IF EXISTS transaction_categories');
    await db.query('DROP TABLE IF EXISTS accounts');

    const [tbls] = await db.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('transactions','payment_transactions')`
    );
    const names = new Set(
      ((tbls as { TABLE_NAME: string }[]) || []).map((t) => t.TABLE_NAME)
    );
    if (names.has('transactions') && !names.has('payment_transactions')) {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'order_id'`
      );
      if (Array.isArray(cols) && cols.length > 0) {
        await db.query('RENAME TABLE transactions TO payment_transactions');
        console.log('  ✓ Renamed ecommerce table transactions → payment_transactions');
      } else {
        await db.query('DROP TABLE IF EXISTS transactions');
        console.log('  ✓ Dropped legacy non-ecommerce transactions table');
      }
    }
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('  ✓ Removed legacy property/accounting tables\n');
}
