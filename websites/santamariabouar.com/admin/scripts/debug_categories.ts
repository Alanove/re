
import { db } from '../../src/config/database';

async function run() {
    try {
        console.log('--- Categories ---');
        const [categories] = await db.query('SELECT * FROM transaction_categories');
        console.table(categories);

        console.log('--- Accounts ---');
        const [accounts] = await db.query('SELECT * FROM accounts');
        console.table(accounts);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
