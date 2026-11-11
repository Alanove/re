/**
 * Rename homepage tagline CTA from "Shop All" to "Discover".
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

const HTML_COLUMNS = ['tagline_html', 'bridal_intro_html', 'poster_tagline_html'] as const;

function replaceShopAllCta(html: string): string {
  return String(html || '')
    .replace(/>\s*SHOP\s+ALL\s*</gi, '>Discover<')
    .replace(/>\s*Shop\s+All\s*</g, '>Discover<');
}

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(`SHOW TABLES LIKE ?`, [table]);
  return Array.isArray(rows) && rows.length > 0;
}

async function run(): Promise<void> {
  if (!(await tableExists('home_page_content'))) {
    console.log('  home_page_content missing — skip');
    return;
  }

  console.log('Updating homepage CTA copy: Shop All → Discover...');

  const [rows] = await db.query<Record<string, string | null>>(
    `SELECT ${HTML_COLUMNS.join(', ')} FROM home_page_content WHERE id = 1 LIMIT 1`
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) {
    console.log('  no homepage content row — skip');
    return;
  }

  const updates: string[] = [];
  const values: string[] = [];
  for (const col of HTML_COLUMNS) {
    const current = row[col] ?? '';
    const next = replaceShopAllCta(current);
    if (next !== current) {
      updates.push(`${col} = ?`);
      values.push(next);
    }
  }

  if (!updates.length) {
    console.log('  ✓ homepage CTAs already use Discover');
    return;
  }

  await db.execute(`UPDATE home_page_content SET ${updates.join(', ')} WHERE id = 1`, values);
  console.log(`  ✓ updated ${updates.length} homepage field(s)`);
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
