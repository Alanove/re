"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuService = exports.MenuService = void 0;
const database_1 = require("../../src/config/database");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class MenuService {
    constructor() { }
    static getInstance() {
        if (!MenuService.instance) {
            MenuService.instance = new MenuService();
        }
        return MenuService.instance;
    }
    reloadMenus() {
    }
    async getAllMenus() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title as name,
          '' as description
        FROM menu
        WHERE parent_id IS NULL
        ORDER BY order_index
      `);
            const menus = rows.map((row) => ({
                ...row,
                items: []
            }));
            for (const menu of menus) {
                menu.items = await this.getMenuItems(menu.id);
            }
            return menus;
        }
        catch (error) {
            console.error('Error fetching menus:', error);
            return [];
        }
    }
    async getMenuById(id) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title as name,
          '' as description
        FROM menu
        WHERE id = ?
      `, [id]);
            const results = rows;
            if (results.length === 0)
                return null;
            const menu = {
                ...results[0],
                items: await this.getMenuItems(id)
            };
            return menu;
        }
        catch (error) {
            console.error('Error fetching menu by ID:', error);
            return null;
        }
    }
    async createMenu(menuData) {
        try {
            console.log('MenuService.createMenu called with:', menuData);
            const [result] = await database_1.db.query('INSERT INTO menu (title, parent_id, order_index, url, is_visible) VALUES (?, NULL, 0, "", 1)', [menuData.name]);
            console.log('Insert result:', result);
            const newId = result.insertId.toString();
            console.log('New menu ID:', newId);
            return {
                id: newId,
                name: menuData.name,
                description: menuData.description,
                items: []
            };
        }
        catch (error) {
            console.error('Error creating menu in service:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw new Error('Failed to create menu: ' + error.message);
        }
    }
    async updateMenu(id, updates) {
        try {
            if (updates.name) {
                await database_1.db.query('UPDATE menu SET title = ? WHERE id = ?', [updates.name, id]);
            }
            return await this.getMenuById(id);
        }
        catch (error) {
            console.error('Error updating menu:', error);
            return null;
        }
    }
    async deleteMenu(id) {
        try {
            console.log('MenuService.deleteMenu called with ID:', id);
            console.log('Deleting child menu items recursively...');
            await this.deleteMenuItemsRecursively(id);
            console.log('Deleting menu record itself...');
            const [result] = await database_1.db.query('DELETE FROM menu WHERE id = ?', [id]);
            const affectedRows = result.affectedRows;
            console.log('Delete affected rows:', affectedRows);
            return affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting menu (detailed):', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }
    async deleteMenuItemsRecursively(parentId) {
        try {
            console.log('deleteMenuItemsRecursively called for parent ID:', parentId);
            const [children] = await database_1.db.query('SELECT id, css_class as type, url as link FROM menu WHERE parent_id = ?', [parentId]);
            const childrenArray = children;
            console.log('Found', childrenArray.length, 'children for parent', parentId);
            for (const child of childrenArray) {
                if (child.type === 'file' && child.link) {
                    await this.deleteMenuItemFile(child.link);
                }
                console.log('Recursively deleting child:', child.id);
                await this.deleteMenuItemsRecursively(child.id.toString());
            }
            console.log('Deleting direct children of:', parentId);
            const [result] = await database_1.db.query('DELETE FROM menu WHERE parent_id = ?', [parentId]);
            console.log('Deleted', result.affectedRows, 'direct children');
        }
        catch (error) {
            console.error('Error deleting menu items recursively for parent', parentId, ':', error);
            throw error;
        }
    }
    async getMenuItems(menuId) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          title,
          url as link,
          order_index as sort,
          is_visible as active,
          COALESCE(css_class, '') as type
        FROM menu
        WHERE parent_id = ?
        ORDER BY order_index
      `, [menuId]);
            const items = rows.map((row) => ({
                id: row.id,
                title: row.title,
                type: row.type,
                link: row.link || '',
                sort: Math.max(1, Math.round(row.sort / 10)),
                active: Boolean(row.active),
                children: []
            }));
            for (const item of items) {
                item.children = await this.getMenuItems(item.id);
            }
            return items;
        }
        catch (error) {
            console.error('Error fetching menu items:', error);
            return [];
        }
    }
    async deleteMenuItem(menuId, itemId) {
        try {
            console.log('Deleting menu item:', itemId, 'from menu:', menuId);
            const menu = await this.getMenuById(menuId);
            if (menu) {
                const findItem = (items) => {
                    for (const item of items) {
                        if (item.id === itemId)
                            return item;
                        if (item.children && item.children.length > 0) {
                            const found = findItem(item.children);
                            if (found)
                                return found;
                        }
                    }
                    return null;
                };
                const itemToDelete = findItem(menu.items);
                if (itemToDelete && itemToDelete.type === 'file' && itemToDelete.link) {
                    await this.deleteMenuItemFile(itemToDelete.link);
                }
            }
            await this.deleteMenuItemsRecursively(itemId);
            const [result] = await database_1.db.query('DELETE FROM menu WHERE id = ?', [itemId]);
            const affectedRows = result.affectedRows;
            console.log('Delete affected rows:', affectedRows);
            return affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting menu item:', error);
            return false;
        }
    }
    async updateMenuItemsForPageKey(oldKey, newKey) {
        try {
            if (!oldKey || !newKey || oldKey === newKey) {
                return 0;
            }
            const normalizedOldKey = oldKey.startsWith('/') ? oldKey.substring(1) : oldKey;
            const normalizedNewKey = newKey.startsWith('/') ? newKey.substring(1) : newKey;
            console.log(`Updating menu items: searching for page key "${normalizedOldKey}" to update to "${normalizedNewKey}"`);
            const [checkResult] = await database_1.db.query(`SELECT id, title, url, css_class FROM menu 
         WHERE css_class = 'page' 
         AND (url = ? OR url = ?)`, [normalizedOldKey, oldKey]);
            console.log(`Found ${checkResult.length} menu item(s) with old key:`, checkResult.map((item) => ({ id: item.id, title: item.title, url: item.url })));
            const [result] = await database_1.db.query(`UPDATE menu 
         SET url = ? 
         WHERE css_class = 'page' 
         AND (url = ? OR url = ?)`, [normalizedNewKey, normalizedOldKey, oldKey]);
            const affectedRows = result.affectedRows || 0;
            console.log(`Updated ${affectedRows} menu item(s) from page key "${normalizedOldKey}" to "${normalizedNewKey}"`);
            return affectedRows;
        }
        catch (error) {
            console.error('Error updating menu items for page key:', error);
            return 0;
        }
    }
    async deleteMenuItemFile(filePath) {
        try {
            const fileName = filePath.split('/').pop();
            if (!fileName)
                return;
            const fileSystemPath = path.join(process.cwd(), 'public', 'menu', 'files', fileName);
            if (fs.existsSync(fileSystemPath)) {
                fs.unlinkSync(fileSystemPath);
                console.log('Deleted menu item file:', fileSystemPath);
            }
        }
        catch (error) {
            console.error('Error deleting menu item file:', error);
        }
    }
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
    validateMenuData(data) {
        const errors = [];
        if (!data.name || data.name.trim() === '') {
            errors.push('Menu name is required');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateMenuItemData(data) {
        const errors = [];
        if (!data.title || data.title.trim() === '') {
            errors.push('Menu item title is required');
        }
        if (data.type === undefined || data.type === null) {
            errors.push('Menu item type is required');
        }
        if (data.type && data.type !== '' && (!data.link || data.link.trim() === '')) {
            errors.push('Menu item link is required for this type');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async addMenuItem(menuId, itemData) {
        try {
            console.log('Adding menu item to menu:', menuId, 'with data:', itemData);
            let sortOrder;
            if (itemData.sort !== undefined && itemData.sort !== null) {
                sortOrder = itemData.sort * 10;
            }
            else {
                const [sortResult] = await database_1.db.query('SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ? OR (parent_id IS NULL AND id = ?)', [menuId, menuId]);
                const maxSort = sortResult[0]?.max_sort || 0;
                sortOrder = Math.floor(maxSort / 10) * 10 + 10;
            }
            const [result] = await database_1.db.query('INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)', [itemData.title, menuId, sortOrder, itemData.link, itemData.active ? 1 : 0, itemData.type]);
            const newId = result.insertId.toString();
            console.log('Menu item added with ID:', newId);
            return {
                id: newId,
                ...itemData,
                children: []
            };
        }
        catch (error) {
            console.error('Error adding menu item:', error);
            return null;
        }
    }
    async addChildMenuItem(menuId, parentId, itemData) {
        try {
            console.log('Adding child menu item to parent:', parentId, 'with data:', itemData);
            let sortOrder;
            if (itemData.sort !== undefined && itemData.sort !== null) {
                sortOrder = itemData.sort * 10;
            }
            else {
                const [sortResult] = await database_1.db.query('SELECT MAX(order_index) as max_sort FROM menu WHERE parent_id = ?', [parentId]);
                const maxSort = sortResult[0]?.max_sort || 0;
                sortOrder = Math.floor(maxSort / 10) * 10 + 10;
            }
            const [result] = await database_1.db.query('INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)', [itemData.title, parentId, sortOrder, itemData.link, itemData.active ? 1 : 0, itemData.type]);
            const newId = result.insertId.toString();
            console.log('Child menu item added with ID:', newId);
            return {
                id: newId,
                ...itemData,
                children: []
            };
        }
        catch (error) {
            console.error('Error adding child menu item:', error);
            return null;
        }
    }
    async updateMenuItem(menuId, itemId, updates) {
        try {
            console.log('Updating menu item:', itemId, 'in menu:', menuId, 'with updates:', updates);
            const updateFields = [];
            const updateValues = [];
            if (updates.title !== undefined) {
                updateFields.push('title = ?');
                updateValues.push(updates.title.trim());
            }
            if (updates.type !== undefined) {
                updateFields.push('css_class = ?');
                updateValues.push(updates.type);
            }
            if (updates.link !== undefined) {
                updateFields.push('url = ?');
                updateValues.push(updates.link.trim());
            }
            if (updates.sort !== undefined) {
                updateFields.push('order_index = ?');
                updateValues.push(updates.sort * 10);
            }
            if (updates.active !== undefined) {
                updateFields.push('is_visible = ?');
                updateValues.push(updates.active ? 1 : 0);
            }
            if (updateFields.length === 0) {
                console.log('No fields to update');
                const menu = await this.getMenuById(menuId);
                if (menu) {
                    const findItem = (items) => {
                        for (const item of items) {
                            if (item.id === itemId)
                                return item;
                            if (item.children && item.children.length > 0) {
                                const found = findItem(item.children);
                                if (found)
                                    return found;
                            }
                        }
                        return null;
                    };
                    return findItem(menu.items);
                }
                return null;
            }
            updateValues.push(itemId);
            const query = `UPDATE menu SET ${updateFields.join(', ')} WHERE id = ?`;
            await database_1.db.query(query, updateValues);
            console.log('Menu item updated successfully');
            const menu = await this.getMenuById(menuId);
            if (menu) {
                const findItem = (items) => {
                    for (const item of items) {
                        if (item.id === itemId)
                            return item;
                        if (item.children && item.children.length > 0) {
                            const found = findItem(item.children);
                            if (found)
                                return found;
                        }
                    }
                    return null;
                };
                return findItem(menu.items);
            }
            return null;
        }
        catch (error) {
            console.error('Error updating menu item:', error);
            return null;
        }
    }
    async moveMenuItem(menuId, itemId, newSort, newParentId) {
        try {
            console.log('Moving menu item:', itemId, 'to sort:', newSort, 'parent:', newParentId);
            const [currentItemRows] = await database_1.db.query('SELECT id, parent_id, order_index FROM menu WHERE id = ?', [itemId]);
            const currentItem = currentItemRows[0];
            if (!currentItem) {
                console.error('Menu item not found:', itemId);
                return false;
            }
            const oldParentId = currentItem.parent_id;
            const newParentIdNum = newParentId ? parseInt(newParentId) : parseInt(menuId);
            const newSortMultiplied = newSort * 10;
            const connection = await database_1.db.getConnection();
            try {
                await connection.beginTransaction();
                let targetParentForQuery = newParentIdNum;
                if (oldParentId !== newParentIdNum) {
                    targetParentForQuery = newParentIdNum;
                }
                else {
                    targetParentForQuery = oldParentId;
                }
                const [allItemsRows] = await connection.query('SELECT id, order_index FROM menu WHERE parent_id = ? ORDER BY order_index', [targetParentForQuery]);
                const allItems = allItemsRows;
                const itemsWithoutMoved = allItems.filter(item => parseInt(item.id) !== parseInt(itemId));
                if (oldParentId !== newParentIdNum) {
                    await connection.query('UPDATE menu SET parent_id = ? WHERE id = ?', [newParentIdNum, itemId]);
                }
                const newOrderedItems = [];
                let currentSort = 10;
                for (let i = 0; i < itemsWithoutMoved.length; i++) {
                    if (i === newSort - 1) {
                        newOrderedItems.push({ id: itemId, order_index: currentSort });
                        currentSort += 10;
                    }
                    newOrderedItems.push({ id: itemsWithoutMoved[i].id, order_index: currentSort });
                    currentSort += 10;
                }
                if (newSort > itemsWithoutMoved.length) {
                    newOrderedItems.push({ id: itemId, order_index: currentSort });
                }
                for (const item of newOrderedItems) {
                    await connection.query('UPDATE menu SET order_index = ? WHERE id = ?', [item.order_index, item.id]);
                }
                await connection.commit();
                console.log('Menu item moved successfully');
                return true;
            }
            catch (error) {
                await connection.rollback();
                throw error;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error('Error moving menu item:', error);
            return false;
        }
    }
}
exports.MenuService = MenuService;
exports.menuService = MenuService.getInstance();
//# sourceMappingURL=menuService.js.map