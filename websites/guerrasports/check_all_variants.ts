
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '.env.development');
dotenv.config({ path: envPath });

import { db } from './src/config/database';

async function checkAllVariants() {
  try {
    console.log('Checking all variants for missing attributes...');
    
    // Count total variants
    const [count] = await db.query<any>('SELECT COUNT(*) as total FROM product_variants');
    console.log(`Total variants in DB: ${count[0].total}`);

    // Find broken ones
    const [broken] = await db.query<any>(
      "SELECT pv.id, pv.product_id, pv.name, pv.attributes, p.slug as product_slug FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.attributes IS NULL OR pv.attributes = '{}' OR pv.attributes = 'null'"
    );

    console.log(`Found ${broken.length} variants with missing attributes.`);
    
    if (broken.length > 0) {
        console.log('Sample of broken variants:');
        broken.slice(0, 5).forEach((v: any) => {
            console.log(`- ID: ${v.id}, Product: ${v.product_slug}, Name: "${v.name}"`);
        });
        
        // Group by product
        const productCounts: {[key: string]: number} = {};
        broken.forEach((v: any) => {
            productCounts[v.product_slug] = (productCounts[v.product_slug] || 0) + 1;
        });
        console.log(`\nAffected Products (${Object.keys(productCounts).length}):`);
        Object.entries(productCounts).forEach(([slug, count]) => {
            console.log(`- ${slug}: ${count} bad variants`);
        });
    }

  } catch (err) {
    console.error(err);
  } finally {
    try { await db.close(); } catch(e){}
    process.exit();
  }
}

checkAllVariants();
