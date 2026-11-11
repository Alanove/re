
import { db } from '../../src/config/database';

async function run() {
    try {
        const [rows] = await db.query("SELECT id, category_id, description, type, amount FROM transactions WHERE description LIKE '%Transfer%' LIMIT 10");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
