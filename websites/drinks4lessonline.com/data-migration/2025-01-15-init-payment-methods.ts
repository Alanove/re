/**
 * Initialize default payment methods
 * Run this after the e-commerce schema migration
 */

// Load environment variables
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import paymentService from '../src/services/paymentService';

async function initializePaymentMethods() {
  try {
    console.log('🚀 Initializing default payment methods...\n');

    // Check if methods already exist
    const [existing] = await db.query<any[]>(
      'SELECT id FROM payment_methods LIMIT 1'
    );

    if (existing.length > 0) {
      console.log('✅ Payment methods already initialized\n');
      return;
    }

    // Insert Cash on Delivery
    await db.query(
      `INSERT INTO payment_methods (name, code, type, description, is_active, order_index)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'Cash on Delivery',
        'cash_on_delivery',
        'manual',
        'Pay with cash when your order is delivered',
        true,
        1
      ]
    );
    console.log('  ✓ Created: Cash on Delivery');

    // Insert NetCommerce placeholder (sandbox)
    await db.query(
      `INSERT INTO payment_methods (name, code, type, description, config, is_active, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Pay with bank card',
        'netcommerce',
        'gateway',
        'Pay with bank card',
        JSON.stringify({ sandbox: true }),
        true,
        2
      ]
    );
    console.log('  ✓ Created: Pay with bank card');

    console.log('\n✅ Payment methods initialized successfully!\n');
  } catch (error) {
    console.error('❌ Error initializing payment methods:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializePaymentMethods()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export default initializePaymentMethods;

