const fs = require('fs');
const path = require('path');

// Test menu functionality
console.log('Testing Menu Functionality...\n');

// Test 1: Check if menu.json exists
const menuPath = path.join(__dirname, '../data/menu.json');
console.log('1. Checking if menu.json exists...');
if (fs.existsSync(menuPath)) {
    console.log('✅ menu.json exists');
    
    // Test 2: Check if menu.json is valid JSON
    try {
        const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
        console.log('✅ menu.json is valid JSON');
        
        // Test 3: Check menu structure
        if (menuData.menus && Array.isArray(menuData.menus)) {
            console.log('✅ menu.json has valid structure with menus array');
            
            // Test 4: Check sample menu items
            if (menuData.menus.length > 0) {
                const firstMenu = menuData.menus[0];
                console.log(`✅ Found menu: "${firstMenu.name}" with ${firstMenu.items.length} items`);
                
                if (firstMenu.items.length > 0) {
                    const firstItem = firstMenu.items[0];
                    console.log(`✅ Sample menu item: "${firstItem.title}" (${firstItem.type})`);
                }
            }
        } else {
            console.log('❌ menu.json does not have valid structure');
        }
    } catch (error) {
        console.log('❌ menu.json is not valid JSON:', error.message);
    }
} else {
    console.log('❌ menu.json does not exist');
}

// Test 5: Check if MenuService can be imported
console.log('\n2. Testing MenuService import...');
try {
    const { MenuService } = require('../dist/admin/services/menuService');
    console.log('✅ MenuService can be imported');
    
    // Test 6: Check if MenuService methods exist
    const menuService = MenuService.getInstance();
    console.log('✅ MenuService.getInstance() works');
    
    if (typeof menuService.getAllMenus === 'function') {
        console.log('✅ getAllMenus method exists');
    }
    
    if (typeof menuService.createMenu === 'function') {
        console.log('✅ createMenu method exists');
    }
    
    if (typeof menuService.addMenuItem === 'function') {
        console.log('✅ addMenuItem method exists');
    }
    
} catch (error) {
    console.log('❌ MenuService import failed:', error.message);
}

// Test 7: Check if MenuController can be imported
console.log('\n3. Testing MenuController import...');
try {
    const { MenuController } = require('../dist/admin/controllers/menuController');
    console.log('✅ MenuController can be imported');
    
    if (typeof MenuController.menus === 'function') {
        console.log('✅ MenuController.menus method exists');
    }
    
    if (typeof MenuController.createMenu === 'function') {
        console.log('✅ MenuController.createMenu method exists');
    }
    
    if (typeof MenuController.editMenu === 'function') {
        console.log('✅ MenuController.editMenu method exists');
    }
    
} catch (error) {
    console.log('❌ MenuController import failed:', error.message);
}

// Test 8: Check if routes are properly configured
console.log('\n4. Testing routes configuration...');
try {
    const routes = require('../dist/admin/routes');
    console.log('✅ Admin routes can be imported');
} catch (error) {
    console.log('❌ Admin routes import failed:', error.message);
}

console.log('\n🎉 Menu functionality test completed!');
console.log('\nTo test the menu functionality:');
console.log('1. Start the server: npm start');
console.log('2. Navigate to: http://localhost:3000/admin/menus');
console.log('3. Try creating, editing, and managing menus');
