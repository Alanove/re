import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function run(): Promise<void> {
  console.log('\n🔄 Migration: pages.publish_date\n');

  const [cols] = await db.query<{ Field: string }[]>(
    `SHOW COLUMNS FROM pages WHERE Field = ?`,
    ['publish_date']
  );

  if (cols && cols.length > 0) {
    console.log('  ⚠️  pages.publish_date already exists — skip\n');
    console.log('✅ Done.\n');
    return;
  }

  await db.query(`
    ALTER TABLE pages
      ADD COLUMN publish_date DATE NULL AFTER order_index,
      ADD INDEX idx_pages_publish_date (publish_date)
  `);

  console.log('  ✓ Added pages.publish_date (+ index)\n');
  console.log('✅ Done.\n');
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
