
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { db } from '../src/config/database';

async function inspectAccessories() {
  try {
    // Find Accessories category
    const [cats] = await db.query<any>("SELECT id, name FROM product_categories WHERE name LIKE '%Accessorie%'");
    
    if (cats.length === 0) {
      console.log("Category 'Accessories' not found.");
      return;
    }
    
    const cat = cats[0];
    console.log(`Category: ${cat.name} (ID: ${cat.id})`);

    // Find products linked to it
    const [products] = await db.query<any>(
      `SELECT p.id, p.name, p.status, p.is_active, p.category_id
       FROM products p 
       LEFT JOIN product_category_relations pcr ON p.id = pcr.product_id 
       WHERE (p.category_id = ? OR pcr.category_id = ?) 
       ORDER BY p.id ASC`,
      [cat.id, cat.id]
    );

    console.log(`Found ${products.length} products:`);
    products.forEach((p: any) => {
      console.log(`- [${p.id}] ${p.name} | Status: ${p.status} | Active: ${p.is_active} | MainCatID: ${p.category_id}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

inspectAccessories();
