
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars FIRST
const envPath = path.resolve(__dirname, '.env.development');
dotenv.config({ path: envPath });

import { db } from './src/config/database';

async function checkValidAttributes() {
  try {
    const [rows] = await db.query<any>(
      "SELECT * FROM product_variants WHERE attributes IS NOT NULL AND attributes != '{}' AND attributes != 'null' LIMIT 1"
    );
    
    if (rows.length > 0) {
      console.log('Valid variant example:', rows[0].name);
      console.log('Attributes:', typeof rows[0].attributes === 'string' ? rows[0].attributes : JSON.stringify(rows[0].attributes));
    } else {
      console.log('No valid variants found in DB?');
    }
  } catch (err) {
    console.error(err);
  } finally {
    try {
        await db.close();
    } catch (e) {}
    process.exit();
  }
}

checkValidAttributes();
