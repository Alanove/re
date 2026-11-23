import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { CategoryManagementService } from '../admin/services/categoryManagementService';
import { db } from '../src/config/database';

async function testUpdate() {
  try {
    const service = CategoryManagementService.getInstance();
    
    // 1. Create a dummy category
    const category = await service.createCategory({
        name: 'Test Category Deletion',
        slug: 'test-category-deletion',
        image_url: '/images/test.jpg'
    });
    console.log('Created category:', category.id, category.image_url);

    // 2. Update to null
    console.log('Updating image_url to null...');
    await service.updateCategory(category.id, { image_url: null } as any);

    // 3. Verify
    const updated = await service.getCategoryById(category.id);
    console.log('Updated category image_url:', updated?.image_url);

    if (updated?.image_url === null || updated?.image_url === '') {
        console.log('SUCCESS: image_url updated to null');
    } else {
        console.log('FAILURE: image_url is', updated?.image_url);
    }

    // Clean up
    await service.deleteCategory(category.id);
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit();
  }
}

testUpdate();
