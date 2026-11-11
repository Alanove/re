/**
 * Consolidate hero tagline to one HTML field; service column titles → plain VARCHAR.
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

function stripHtml(s: string): string {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run(): Promise<void> {
  if (!(await tableExists('home_page_content'))) {
    console.log('  home_page_content missing — skip (run 2026-05-16 migration first)');
    return;
  }

  const hasLegacyIntro = await columnExists('home_page_content', 'introducing_html');
  if (!hasLegacyIntro) {
    console.log('  ✓ home_page_content already on tagline_html / plain titles schema');
    return;
  }

  console.log('Migrating home_page_content: single tagline + plain column titles...');

  if (!(await columnExists('home_page_content', 'tagline_html'))) {
    await db.query(`ALTER TABLE home_page_content ADD COLUMN tagline_html MEDIUMTEXT NULL`);
  }
  if (!(await columnExists('home_page_content', 'care_title'))) {
    await db.query(
      `ALTER TABLE home_page_content ADD COLUMN care_title VARCHAR(255) NOT NULL DEFAULT ''`
    );
  }
  if (!(await columnExists('home_page_content', 'appointments_title'))) {
    await db.query(
      `ALTER TABLE home_page_content ADD COLUMN appointments_title VARCHAR(255) NOT NULL DEFAULT ''`
    );
  }
  if (!(await columnExists('home_page_content', 'bridal_title'))) {
    await db.query(
      `ALTER TABLE home_page_content ADD COLUMN bridal_title VARCHAR(255) NOT NULL DEFAULT ''`
    );
  }

  const [rows] = await db.query(`SELECT * FROM home_page_content WHERE id = 1`);
  const list = rows as Record<string, unknown>[];
  const r = list?.[0];
  if (r) {
    const intro = String(r['introducing_html'] ?? '');
    const head = String(r['headline_html'] ?? '');
    const shop = String(r['shop_cta_html'] ?? '');
    const tagline = [
      `<div class="luxury-hero-tagline-intro">${intro}</div>`,
      `<div class="luxury-hero-tagline-headline">${head}</div>`,
      `<div class="luxury-hero-tagline-shop">${shop}</div>`
    ].join('');

    const careT = stripHtml(String(r['care_title_html'] ?? '')) || 'Customer Care';
    const apptT = stripHtml(String(r['appointments_title_html'] ?? '')) || 'Appointments';
    const bridalT = stripHtml(String(r['bridal_title_html'] ?? '')) || 'Bridal Services';

    await db.execute(
      `UPDATE home_page_content SET
        tagline_html = ?,
        care_title = ?,
        appointments_title = ?,
        bridal_title = ?
      WHERE id = 1`,
      [tagline, careT, apptT, bridalT]
    );
  }

  await db.query(`
    ALTER TABLE home_page_content
      DROP COLUMN introducing_html,
      DROP COLUMN headline_html,
      DROP COLUMN shop_cta_html,
      DROP COLUMN care_title_html,
      DROP COLUMN appointments_title_html,
      DROP COLUMN bridal_title_html
  `);

  console.log('  ✓ home_page_content schema updated');
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
