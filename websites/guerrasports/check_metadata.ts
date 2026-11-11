
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '.env.development');
dotenv.config({ path: envPath });

import { db } from './src/config/database';

async function checkMetadata() {
  try {
    console.log('--- Variant Types ---');
    const [types] = await db.query<any>("SELECT * FROM variant_types WHERE id IN (1, 3)");
    types.forEach((t: any) => console.log(`ID=${t.id} Name=${t.name} Slug=${t.slug}`));

    console.log('\n--- Variant Values ---');
    // IDs from previous step: Color=[31,1,36], Size=[49,48,47]
    const ids = [31, 1, 36, 49, 48, 47];
    const [values] = await db.query<any>("SELECT * FROM variant_type_values WHERE id IN (?)", [ids]);
    values.forEach((v: any) => console.log(`ID=${v.id} Val=${v.value} (VariantType=${v.variant_type_id})`));

  } catch (err) {
    console.error(err);
  } finally {
    try { await db.close(); } catch(e){}
    process.exit();
  }
}

checkMetadata();
