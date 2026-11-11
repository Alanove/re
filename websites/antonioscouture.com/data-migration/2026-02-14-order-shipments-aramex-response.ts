// Add column to store full Aramex CreateShipments API response (JSON or XML string)
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

async function up() {
  console.log('Adding create_shipment_response to order_shipments...');
  try {
    await db.query(`
      ALTER TABLE order_shipments
      ADD COLUMN create_shipment_response TEXT NULL DEFAULT NULL
      COMMENT 'Full CreateShipment API response (JSON or XML) - provider-agnostic'
      AFTER waybill_label_url
    `);
  } catch (err: any) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('  Column create_shipment_response already exists');
    } else throw err;
  }
  console.log('  ✓ order_shipments updated');
}

async function down() {
  await db.query('ALTER TABLE order_shipments DROP COLUMN IF EXISTS create_shipment_response');
  console.log('  ✓ create_shipment_response dropped');
}

async function run(): Promise<void> {
  await up();
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
