import { db } from './src/config/database';

async function dumpCategories() {
    try {
        const [rows] = await db.query('SELECT id, name, type FROM transaction_categories');
        (rows as any[]).forEach(row => {
            console.log(`ID: ${row.id} | Name: ${row.name} | Type: ${row.type}`);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

dumpCategories();
