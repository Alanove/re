
import { db } from '../../src/config/database';

async function run() {
    try {
        console.log('--- Category George ---');
        const [categories] = await db.query("SELECT * FROM transaction_categories WHERE name LIKE '%George%'");
        console.log(JSON.stringify(categories, null, 2));

        if ((categories as any[]).length > 0) {
            const catId = (categories as any[])[0].id;
            console.log('--- Transactions under George ---');
            const [transactions] = await db.query("SELECT * FROM transactions WHERE category_id = ? LIMIT 10", [catId]);
            console.log(JSON.stringify(transactions, null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
