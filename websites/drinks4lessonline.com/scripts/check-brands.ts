import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables BEFORE other imports
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

(async () => {
    try {
        const [rows] = await db.query('SELECT name, logo_url FROM brands ORDER BY id DESC LIMIT 20');
        console.log('--- Recent Brands in Database ---');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error('Error querying brands:', err);
        process.exit(1);
    }
})();
