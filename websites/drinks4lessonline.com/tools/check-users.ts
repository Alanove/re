
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function checkUsers() {
    try {
        const [rows] = await db.query('SELECT id, username, email, role, status FROM users');
        console.log('Users found:', rows);
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        process.exit();
    }
}

checkUsers();
