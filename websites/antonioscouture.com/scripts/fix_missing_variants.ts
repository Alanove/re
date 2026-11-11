
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
const envPath = path.resolve(__dirname, '../.env.development');
dotenv.config({ path: envPath });

import { db } from '../src/config/database';

async function fixVariants() {
  try {
    console.log('Starting Auto-Fix for Missing Variant Attributes...');

    // 1. Get all known attribute values to help with matching
    // Note: This relies on the global product_attributes table if you have one, 
    // or we can just use the heuristics if there's no central attribute registry.
    // For this project, we'll use a robust heuristic + simple value matching.

    // 2. Find broken variants
    const [variants] = await db.query<any>(
      `SELECT pv.id, pv.product_id, pv.name, pv.sku, p.slug 
       FROM product_variants pv 
       JOIN products p ON pv.product_id = p.id 
       WHERE pv.attributes IS NULL 
          OR pv.attributes = '{}' 
          OR pv.attributes = 'null'`
    );

    console.log(`Found ${variants.length} broken variants.`);

    if (variants.length === 0) {
      console.log('No variants to fix.');
      return;
    }

    let fixedCount = 0;

    for (const v of variants) {
      const attributes: any = {};
      
      // Known Attribute Maps
      const colorMap: {[key: string]: string} = {
        'WT': 'White', 'WH': 'White', 'WHT': 'White',
        'BK': 'Black', 'BLK': 'Black',
        'RD': 'Red',  'RED': 'Red',
        'BL': 'Blue', 'BLU': 'Blue',
        'GD': 'Gold', 'GLD': 'Gold',
        'SV': 'Silver', 'SLV': 'Silver',
        'PK': 'Pink', 'PNK': 'Pink',
        'BG': 'Beige', 
        'GY': 'Grey', 'GRY': 'Grey',
        'GR': 'Green', 'GRN': 'Green'
      };
      
      const sizeMap: {[key: string]: string} = {
          'S': 'S', 'SM': 'S', 'SMALL': 'S',
          'M': 'M', 'MD': 'M', 'MEDIUM': 'M',
          'L': 'L', 'LG': 'L', 'LARGE': 'L',
          'XL': 'XL', 'X': 'XL',
          'XS': 'XS',
          '10': '10oz', '12': '12oz', '14': '14oz', '16': '16oz', '18': '18oz',
          '10OZ': '10oz', '12OZ': '12oz', '14OZ': '14oz', '16OZ': '16oz'
      };

      // 1. Try Name Parsing
      const nameLower = (v.name || '').toLowerCase();
      // ... (keep existing name parsing logic if valid) ...

      // 2. Try SKU Parsing (Prioritize SKU if Name failed or is empty)
      // Expect SKU like: BG-MAG-WT-12-1 or MAG-WT-12
      if (v.sku && Object.keys(attributes).length === 0) {
          const skuParts = v.sku.split(/[-_]/); // Split by dash or underscore
          
          for (const part of skuParts) {
              const upperPart = part.toUpperCase();
              
              // Check Color Map
              if (colorMap[upperPart]) {
                  attributes['Color'] = colorMap[upperPart];
              }
              
              // Check Size Map
              if (sizeMap[upperPart]) {
                  attributes['Size'] = sizeMap[upperPart];
              }
          }
      }

      if (Object.keys(attributes).length > 0) {
          console.log(`[FIXING] Variant ID ${v.id} (Name: "${v.name}", SKU: "${v.sku}") => ${JSON.stringify(attributes)}`);
          
          await db.query(
              'UPDATE product_variants SET attributes = ? WHERE id = ?',
              [JSON.stringify(attributes), v.id]
          );
          fixedCount++;
      } else {
          console.warn(`[SKIPPING] Could not parse attributes for: ID ${v.id} (Name: "${v.name}", SKU: "${v.sku}")`);
      }
    }

    console.log(`\nOperation Complete. Fixed ${fixedCount} of ${variants.length} variants.`);

  } catch (error) {
    console.error('Error in fix script:', error);
  } finally {
    try { await db.close(); } catch(e){}
    process.exit();
  }
}

fixVariants();
