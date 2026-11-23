
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });

import categoryService from '../services/categoryService';

async function verifyCategoryImages() {
  console.log('Verifying category images...');

  try {
    const categories = await categoryService.getAllCategories(true);
    let validCount = 0;
    let invalidCount = 0;

    for (const cat of categories) {
      if (cat.image_url) {
        if (cat.image_url.includes('/images/categories/')) {
           validCount++;
        } else {
           console.error(`Invalid path for Category ${cat.id}: ${cat.image_url}`);
           invalidCount++;
        }
      }
    }

    console.log(`Verification complete. Valid: ${validCount}, Invalid: ${invalidCount}`);
    if (invalidCount === 0) {
        console.log('SUCCESS: All category images have correct paths.');
        process.exit(0);
    } else {
        console.error('FAILURE: Some category images have incorrect paths.');
        process.exit(1);
    }

  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyCategoryImages();
