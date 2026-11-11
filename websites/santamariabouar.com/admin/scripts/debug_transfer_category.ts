
import { db } from '../../src/config/database';

async function run() {
    try {
        const [rows] = await db.query("SELECT * FROM transaction_categories WHERE name LIKE '%Transfer%'");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
