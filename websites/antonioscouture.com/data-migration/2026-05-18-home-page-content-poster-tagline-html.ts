/**
 * Rich text below the editorial poster banner (same pattern as hero tagline_html).
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(`SHOW TABLES LIKE ?`, [table]);
  return Array.isArray(rows) && rows.length > 0;
}

function escapeAttrHref(href: string): string {
  return String(href || '/products')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultPosterTaglineHtml(buttonLink: string): string {
  const href = escapeAttrHref(buttonLink || '/products');
  return [
    '<div class="luxury-hero-tagline-intro"><p>Introducing</p></div>',
    '<div class="luxury-hero-tagline-headline"><p>Spring 2027 Bridal</p></div>',
    `<div class="luxury-hero-tagline-shop"><p><a href="${href}" class="home-section-link" rel="noopener noreferrer">Discover Now</a></p></div>`
  ].join('');
}

async function run(): Promise<void> {
  if (!(await tableExists('home_page_content'))) {
    console.log('  home_page_content missing — skip (run 2026-05-16 migration first)');
    return;
  }

  if (!(await columnExists('home_page_content', 'poster_tagline_html'))) {
    console.log('Adding home_page_content.poster_tagline_html...');
    await db.query(
      `ALTER TABLE home_page_content ADD COLUMN poster_tagline_html MEDIUMTEXT NULL`
    );
  }

  const [rows] = await db.query<{ poster_button_link: string | null; poster_tagline_html: string | null }>(
    `SELECT poster_button_link, poster_tagline_html FROM home_page_content WHERE id = 1 LIMIT 1`
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  const link =
    row && row.poster_button_link != null && String(row.poster_button_link).trim() !== ''
      ? String(row.poster_button_link).trim()
      : '/products';
  const seed = defaultPosterTaglineHtml(link);

  await db.execute(
    `UPDATE home_page_content SET poster_tagline_html = ?
     WHERE id = 1 AND (poster_tagline_html IS NULL OR TRIM(poster_tagline_html) = '')`,
    [seed]
  );

  console.log('  ✓ poster_tagline_html ready');
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
