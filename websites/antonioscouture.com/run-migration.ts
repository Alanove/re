import { db } from './src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    try {
        console.log('Starting migration...');
        const migrationPath = path.join(__dirname, 'src/database/migrations/add-product-category-relations.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolon to run multiple statements if needed, but our file simple enough
        // db.query usually executes one statement. We might need to split.
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log('Executing statement:', statement.substring(0, 50) + '...');
            await db.query(statement);
        }

        console.log('Migration completed successfully.');
        // Check count
        const [rows] = await db.query<any[]>('SELECT COUNT(*) as c FROM product_category_relations');
        console.log('Rows in product_category_relations:', (rows as any)[0].c);

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
