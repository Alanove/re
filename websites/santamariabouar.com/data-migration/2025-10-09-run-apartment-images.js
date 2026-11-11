// Run apartment images migration
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'sa',
        password: 'P@55w0rd',
        database: 'smb',
        port: 3306
    });

    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync(path.join(__dirname, '2025-10-09-apartment-images.sql'), 'utf8');
        
        // Split by semicolons and execute each statement
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 50) + '...');
                await connection.query(statement);
                console.log('✓ Success');
            }
        }
        
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

runMigration().catch(console.error);

