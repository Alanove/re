/**
 * Homepage CMS extensions: bridal video block, La Maison section.
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const [rows] = await db.query<any>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows?.[0]?.cnt ?? 0) === 0) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  ✓ Added ${table}.${column}`);
  }
}

async function run(): Promise<void> {
  console.log('Extending home_page_content (bridal video, La Maison)...');

  await addColumnIfMissing('home_page_content', 'bridal_video_url', 'VARCHAR(512) NOT NULL DEFAULT ""');
  await addColumnIfMissing('home_page_content', 'bridal_video_poster_url', 'VARCHAR(512) NOT NULL DEFAULT ""');
  await addColumnIfMissing('home_page_content', 'bridal_intro_html', 'MEDIUMTEXT NULL');
  await addColumnIfMissing('home_page_content', 'la_maison_title', 'VARCHAR(255) NOT NULL DEFAULT ""');
  await addColumnIfMissing('home_page_content', 'la_maison_body_html', 'MEDIUMTEXT NULL');
  await addColumnIfMissing('home_page_content', 'la_maison_link', 'VARCHAR(512) NOT NULL DEFAULT ""');

  console.log('  ✓ home_page_content extensions ready');
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
