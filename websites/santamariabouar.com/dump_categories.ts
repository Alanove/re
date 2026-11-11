import { db } from './src/config/database';

async function dumpCategories() {
    try {
        const [rows] = await db.query('SELECT id, name, type FROM transaction_categories');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

dumpCategories();
