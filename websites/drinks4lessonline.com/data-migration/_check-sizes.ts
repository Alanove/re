import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const { db } = require('../src/config/database');

async function check() {
  // All distinct lowercase "color" values
  const [allColor] = await db.query(
    `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.color')) AS color_val
     FROM product_variants
     WHERE JSON_EXTRACT(attributes, '$.color') IS NOT NULL
     ORDER BY color_val`
  );
  console.log('\n=== All distinct lowercase "color" values in product_variants ===');
  console.log(JSON.stringify(allColor, null, 2));

  // All distinct lowercase "size" values
  const [allSize] = await db.query(
    `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.size')) AS size_val
     FROM product_variants
     WHERE JSON_EXTRACT(attributes, '$.size') IS NOT NULL
     ORDER BY size_val`
  );
  console.log('\n=== All distinct lowercase "size" values in product_variants ===');
  console.log(JSON.stringify(allSize, null, 2));

  // All variant_type_values for Color (id=1) and Size (id=3)
  const [colorVals] = await db.query('SELECT id, value FROM variant_type_values WHERE variant_type_id = 1 ORDER BY value');
  console.log('\n=== Color canonical values (variant_type_values) ===');
  console.log(JSON.stringify(colorVals, null, 2));

  const [sizeVals] = await db.query('SELECT id, value FROM variant_type_values WHERE variant_type_id = 3 ORDER BY value');
  console.log('\n=== Size canonical values (variant_type_values) ===');
  console.log(JSON.stringify(sizeVals, null, 2));

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
