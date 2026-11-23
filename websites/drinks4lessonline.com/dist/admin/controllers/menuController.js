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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuController = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const multer_1 = __importDefault(require("multer"));
const adminMenuService_1 = require("../services/adminMenuService");
const menuService_1 = require("../services/menuService");
const pagesService_1 = require("../services/pagesService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const adminMenuService = adminMenuService_1.AdminMenuService.getInstance();
const menuService = menuService_1.MenuService.getInstance();
const pagesService = pagesService_1.PagesService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const menuFileUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const menuFilesDir = path.join(process.cwd(), 'public', 'menu', 'files');
            if (!fs.existsSync(menuFilesDir)) {
                fs.mkdirSync(menuFilesDir, { recursive: true });
            }
            cb(null, menuFilesDir);
        },
        filename: (req, file, cb) => {
            const originalName = file.originalname;
            const extension = originalName.split('.').pop();
            const uniqueId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
            const fileName = `${uniqueId}.${extension}`;
            cb(null, fileName);
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});
class MenuController {
    static async menus(req, res) {
        try {
            const menus = await menuService.getAllMenus();
            const siteTitle = await siteSettingsService.getSiteTitle();
            const totalMenus = menus.length;
            const totalItems = menus.reduce((sum, menu) => sum + (menu.items?.length || 0), 0);
            const statistics = {
                totalMenus,
                totalItems
            };
            const t = res.locals.t || ((key) => key);
            res.render('menus/menus', {
                title: t('menus.title'),
                pageTitle: t('menus.pageTitle'),
                pageSubtitle: t('menus.pageSubtitle'),
                menus: menus,
                statistics: statistics,
                siteTitle: siteTitle,
                success: req.query['success'],
                error: req.query['error']
            });
        }
        catch (error) {
            console.error('Error rendering menus:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createMenu(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const emptyMenu = {
                id: '',
                name: '',
                description: '',
                items: []
            };
            const t = res.locals.t || ((key) => key);
            res.render('menus/create-menu', {
                title: t('menus.createMenu'),
                pageTitle: t('menus.createNewMenu'),
                pageSubtitle: t('menus.addMenu'),
                menu: emptyMenu,
                siteTitle: siteTitle
            });
        }
        catch (error) {
            console.error('Error rendering create menu:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createMenuPost(req, res) {
        try {
            const { name, description } = req.body;
            console.log('Creating menu with:', { name, description });
            if (!name || !name.trim()) {
                console.log('Validation failed: Name is required');
                res.redirect('/admin/menus/create?error=' + encodeURIComponent('Menu name is required'));
                return;
            }
            console.log('Calling menuService.createMenu...');
            const newMenu = await menuService.createMenu({ name, description, items: [] });
            console.log('Menu created successfully:', newMenu);
            res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${newMenu.name}" created successfully`));
        }
        catch (error) {
            console.error('Error creating menu:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            res.redirect('/admin/menus/create?error=' + encodeURIComponent('Failed to create menu: ' + error.message));
        }
    }
    static async editMenu(req, res) {
        try {
            const menuId = req.params.id;
            const menu = await menuService.getMenuById(menuId);
            if (!menu) {
                res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = res.locals.t || ((key) => key);
            res.render('menus/edit-menu', {
                title: t('menus.editMenu'),
                pageTitle: `${t('menus.editMenu')}: ${menu.name}`,
                pageSubtitle: t('menus.updateMenu'),
                menu: menu,
                siteTitle: siteTitle
            });
        }
        catch (error) {
            console.error('Error rendering edit menu:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async editMenuPost(req, res) {
        try {
            const menuId = req.params.id;
            const { name, description } = req.body;
            const updatedMenu = await menuService.updateMenu(menuId, { name, description });
            if (!updatedMenu) {
                res.redirect('/admin/menus?error=' + encodeURIComponent('Menu not found'));
                return;
            }
            res.redirect('/admin/menus?success=' + encodeURIComponent(`Menu "${updatedMenu.name}" updated successfully`));
        }
        catch (error) {
            console.error('Error updating menu:', error);
            res.redirect(`/admin/menus/${req.params.id}/edit?error=${encodeURIComponent('Failed to update menu')}`);
        }
    }
    static async deleteMenu(req, res) {
        try {
            const menuId = req.params.id;
            console.log('Attempting to delete menu with ID:', menuId);
            const menu = await menuService.getMenuById(menuId);
            if (!menu) {
                console.log('Menu not found:', menuId);
                res.status(404).json({ success: false, error: 'Menu not found' });
                return;
            }
            console.log('Deleting menu:', menu.name);
            const deleted = await menuService.deleteMenu(menuId);
            console.log('Delete result:', deleted);
            if (!deleted) {
                console.log('Delete returned false for menu:', menuId);
                res.status(500).json({ success: false, error: 'Failed to delete menu' });
                return;
            }
            res.json({ success: true, message: `Menu "${menu.name}" deleted successfully` });
        }
        catch (error) {
            console.error('Error deleting menu:', error);
            res.status(500).json({ success: false, error: 'Failed to delete menu: ' + error.message });
        }
    }
    static async addMenuItem(req, res) {
        try {
            const menuId = req.params.menuId;
            const { title, type, link, sort, active, parentId } = req.body;
            const activeBoolean = active === true || active === 'true' || active === 1;
            const validation = menuService.validateMenuItemData({ title, type, link, sort: parseInt(sort), active: activeBoolean });
            if (!validation.isValid) {
                res.status(400).json({ success: false, errors: validation.errors });
                return;
            }
            let newItem;
            if (parentId) {
                newItem = await menuService.addChildMenuItem(menuId, parentId, {
                    title: title.trim(),
                    type,
                    link: link.trim(),
                    sort: parseInt(sort),
                    active: activeBoolean
                });
            }
            else {
                newItem = await menuService.addMenuItem(menuId, {
                    title: title.trim(),
                    type,
                    link: link.trim(),
                    sort: parseInt(sort),
                    active: activeBoolean
                });
            }
            if (!newItem) {
                res.status(400).json({ success: false, errors: ['Failed to add menu item'] });
                return;
            }
            res.json({ success: true, item: newItem });
        }
        catch (error) {
            console.error('Error adding menu item:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
    static async updateMenuItem(req, res) {
        try {
            const menuId = req.params.menuId;
            const itemId = req.params.itemId;
            const { title, type, link, sort, active } = req.body;
            const activeBoolean = active === true || active === 'true' || active === 1;
            const updates = {
                title: title?.trim(),
                type: type || '',
                link: link?.trim() || '',
                sort: sort ? parseInt(sort) : undefined,
                active: activeBoolean
            };
            const updatedItem = await menuService.updateMenuItem(menuId, itemId, updates);
            if (!updatedItem) {
                res.status(400).json({ success: false, errors: ['Failed to update menu item'] });
                return;
            }
            res.json({ success: true, item: updatedItem });
        }
        catch (error) {
            console.error('Error updating menu item:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
    static async deleteMenuItem(req, res) {
        try {
            const menuId = req.params.menuId;
            const itemId = req.params.itemId;
            console.log('Deleting menu item:', itemId, 'from menu:', menuId);
            const deleted = await menuService.deleteMenuItem(menuId, itemId);
            if (!deleted) {
                res.status(400).json({ success: false, errors: ['Failed to delete menu item'] });
                return;
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting menu item:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
    static async moveMenuItem(req, res) {
        try {
            const menuId = req.params.menuId;
            const itemId = req.params.itemId;
            const { newSort, newParentId } = req.body;
            if (newSort === undefined || newSort === null) {
                res.status(400).json({ success: false, errors: ['New sort order is required'] });
                return;
            }
            const moved = await menuService.moveMenuItem(menuId, itemId, parseInt(newSort), newParentId || null);
            if (!moved) {
                res.status(400).json({ success: false, errors: ['Failed to move menu item'] });
                return;
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error moving menu item:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
    static async getMenuItems(req, res) {
        try {
            const menuId = req.params.menuId;
            const menu = await menuService.getMenuById(menuId);
            if (!menu) {
                res.status(404).json({ success: false, errors: ['Menu not found'] });
                return;
            }
            res.json({ success: true, items: menu.items });
        }
        catch (error) {
            console.error('Error getting menu items:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
    static async getPages(req, res) {
        try {
            const searchQuery = req.query.search;
            if (searchQuery && searchQuery.trim().length > 0) {
                const pages = await pagesService.searchPages(searchQuery, 20);
                res.json({ success: true, pages });
            }
            else {
                res.json({ success: true, pages: [] });
            }
        }
        catch (error) {
            console.error('Error getting pages:', error);
            res.status(500).json({ success: false, errors: ['Internal server error'] });
        }
    }
}
exports.MenuController = MenuController;
_a = MenuController;
MenuController.uploadFile = [
    menuFileUpload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, error: 'No file uploaded' });
                return;
            }
            const uploadedFile = req.file;
            if (!uploadedFile.originalname || uploadedFile.size === 0) {
                res.status(400).json({ success: false, error: 'Invalid file' });
                return;
            }
            const publicPath = `/menu/files/${uploadedFile.filename}`;
            res.json({
                success: true,
                filePath: publicPath,
                fileName: uploadedFile.filename,
                originalName: uploadedFile.originalname
            });
        }
        catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ success: false, error: 'Failed to upload file' });
        }
    }
];
//# sourceMappingURL=menuController.js.map