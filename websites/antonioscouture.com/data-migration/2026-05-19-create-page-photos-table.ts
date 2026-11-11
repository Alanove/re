import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function run(): Promise<void> {
  console.log('\n🔄 Migration: ensure page_photos table\n');
  await db.query(`
    CREATE TABLE IF NOT EXISTS page_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_id INT NOT NULL,
      filename VARCHAR(500) NOT NULL,
      file_path VARCHAR(1024) NOT NULL,
      thumb_url VARCHAR(512) NULL,
      display_order INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
      INDEX idx_page_id (page_id),
      INDEX idx_page_display_order (page_id, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  ✓ page_photos is present\n');
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
