
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { db } from '../src/config/database';

async function checkDuplicateProducts() {
  console.log('===========================================');
  console.log('  Duplicate Product Name Report');
  console.log('===========================================\n');

  try {
    // Find names that appear more than once
    const [duplicateGroups] = await db.query<any>(`
      SELECT
        name,
        COUNT(*) AS count
      FROM products
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, name ASC
    `);

    if (duplicateGroups.length === 0) {
      console.log('✓ No duplicate product names found.');
      return;
    }

    console.log(`Found ${duplicateGroups.length} name(s) with duplicates:\n`);

    let totalDuplicateRows = 0;

    for (const group of duplicateGroups) {
      totalDuplicateRows += group.count;

      console.log(`─────────────────────────────────────────`);
      console.log(`Name   : "${group.name}"  (${group.count} entries)`);

      const [rows] = await db.query<any>(`
        SELECT
          id,
          name,
          slug,
          sku,
          status,
          is_active,
          created_at,
          updated_at
        FROM products
        WHERE name = ?
        ORDER BY id ASC
      `, [group.name]);

      rows.forEach((r: any, idx: number) => {
        console.log(`  [${idx + 1}] id=${r.id}  slug="${r.slug}"  sku="${r.sku ?? 'N/A'}"  status=${r.status}  active=${r.is_active}  created=${r.created_at}`);
      });

      console.log('');
    }

    console.log('===========================================');
    console.log(`Summary: ${duplicateGroups.length} duplicate name(s), ${totalDuplicateRows} total rows affected`);
    console.log('===========================================');

  } catch (err) {
    console.error('Error running duplicate check:', err);
  } finally {
    process.exit();
  }
}

checkDuplicateProducts();
