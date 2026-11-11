import { db } from './src/config/database';
import fs from 'fs';

async function dump() {
    try {
        const [rows] = await db.query('SELECT * FROM transaction_categories');
        fs.writeFileSync('categories_db.json', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
dump();
