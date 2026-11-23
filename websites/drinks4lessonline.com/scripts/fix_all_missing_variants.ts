
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env vars
const envPath = path.resolve(__dirname, '../.env.development');
dotenv.config({ path: envPath });

import { db } from '../src/config/database';

const LOG_FILE = 'fix_all_variants_log.txt';

function log(message: string) {
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

async function fixAllVariants() {
  try {
    fs.writeFileSync(LOG_FILE, ''); // Clear log
    log('Starting global variant fix (Round 2)...');

    // Get broken variants
    const [variants] = await db.query<any>(
      "SELECT * FROM product_variants WHERE attributes IS NULL OR attributes = '{}' OR attributes = 'null'"
    );
    
    log(`Found ${variants.length} remaining broken variants.`);
    
    let successCount = 0;
    let failCount = 0;

    for (const v of variants) {
      let attributes: any = {};
      
      // Strategy 1: The " - " split (Standard)
      const parts = v.name.split(' - ');
      if (parts.length >= 2) {
          const optionsStr = parts[parts.length - 1];
          const options = optionsStr.split(',').map((s: string) => s.trim());
          attributes = parseOptions(options);
      }

      // Strategy 2: If Strategy 1 failed or yielded nothing, parse the WHOLE name
      if (Object.keys(attributes).length === 0) {
          // Tokenize by spaces
          const tokens = v.name.split(/[\s,-]+/).map((s: string) => s.trim());
          attributes = parseOptions(tokens);
      }

      if (Object.keys(attributes).length > 0) {
        // Prepare update
        log(`Updating ${v.name} -> ${JSON.stringify(attributes)}`);
        await db.query(
            'UPDATE product_variants SET attributes = ? WHERE id = ?',
            [JSON.stringify(attributes), v.id]
        );
        successCount++;
      } else {
          log(`[FAIL] Could not derive attributes for: "${v.name}"`);
          failCount++;
      }
    }
    
    log(`Round 2 fix complete.`);
    log(`Successfully updated: ${successCount}`);
    log(`Failed/Skipped: ${failCount}`);

  } catch (error) {
    log(`Error: ${error}`);
    console.error(error);
  } finally {
    try { await db.close(); } catch(e){}
    process.exit();
  }
}

function parseOptions(options: string[]): any {
    const attributes: any = {};
    for (const opt of options) {
        // Gloves sizes (10oz, 12oz, etc)
        if (/^[0-9]+oz$/i.test(opt)) {
             attributes['Gloves sizes'] = opt;
        }
        // Digital sizes (10, 12, 14 but ambiguous with age/quantity) -> usually assume size if small number?
        // Let's stick to explicit sizes for now
        
        // Standard sizes
        else if (/^(S|M|L|XL|XXL|XS|XXS)$/i.test(opt)) {
             attributes['Size'] = opt;
        } 
        // Colors
        else if (/^(Beige|Black|Blue|Brown|Gold|Green|Grey|Gray|Multi|Nude|Orange|Pink|Purple|Red|Silver|White|Yellow|Rose|Navy|Maroon|Teal|Olive)$/i.test(opt)) {
          attributes['Color'] = opt;
        }
    }
    return attributes;
}

fixAllVariants();
