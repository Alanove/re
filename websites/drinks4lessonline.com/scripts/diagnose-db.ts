
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { db } from '../src/config/database';
import { dbConfig } from '../src/config/database.config';

async function diagnose() {
  console.log('--- Database Diagnosis ---');
  console.log('Host:', dbConfig.host);
  console.log('Database:', dbConfig.database);
  console.log('User:', dbConfig.user);
  
  try {
    const [rows] = await db.query<any>('SELECT COUNT(*) as count FROM products');
    console.log('Total Products:', rows[0].count);

    const [products] = await db.query<any>('SELECT id, name FROM products LIMIT 5');
    console.log('Sample Products:');
    products.forEach((p: any) => console.log(`- ${p.name} (ID: ${p.id})`));

  } catch (err) {
    console.error('Error connecting:', err);
  } finally {
    process.exit();
  }
}

diagnose();
