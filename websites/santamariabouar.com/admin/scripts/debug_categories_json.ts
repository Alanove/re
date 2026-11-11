
import { db } from '../../src/config/database';

async function run() {
    try {
        const [categories] = await db.query('SELECT * FROM transaction_categories');
        console.log(JSON.stringify(categories, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
