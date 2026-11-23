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
exports.adminMenuService = exports.AdminMenuService = void 0;
const fs = __importStar(require("fs"));
const constants_1 = require("../../src/constants");
const i18nService_1 = require("./i18nService");
class AdminMenuService {
    constructor() { }
    static getInstance() {
        if (!AdminMenuService.instance) {
            AdminMenuService.instance = new AdminMenuService();
        }
        return AdminMenuService.instance;
    }
    readMenuData() {
        try {
            const filePath = constants_1.DATA_PATHS.ADMIN_MENU_FILE;
            if (!fs.existsSync(filePath)) {
                console.warn('Admin menu JSON file not found:', filePath);
                return { menu: [] };
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error reading admin menu JSON file:', error);
            return { menu: [] };
        }
    }
    writeMenuData(data) {
        try {
            const filePath = constants_1.DATA_PATHS.ADMIN_MENU_FILE;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Error writing admin menu JSON file:', error);
            throw new Error('Failed to write admin menu data');
        }
    }
    processMenuItems(items, language) {
        const menuKeyMap = {
            'Dashboard': 'menu.dashboard',
            'Pages': 'menu.pages',
            'Tags': 'menu.tags',
            'Home Page Slider': 'menu.slider',
            'Homepage': 'menu.homepage',
            'Projects': 'menu.projects',
            'Menus': 'menu.menus',
            'Users': 'menu.users',
            'Site Settings': 'menu.siteSettings',
            'Apartments': 'menu.apartments',
            'Accounting': 'menu.accounting',
            'Transactions': 'menu.transactions',
            'Payment Parameters': 'menu.payments',
            'Accounts': 'menu.accounts',
            'Transaction Categories': 'menu.transactionCategories',
            'Common Expenses': 'menu.commonExpenses',
            'Products': 'menu.products',
            'Categories': 'menu.categories',
            'Orders': 'menu.orders',
            'Shipments': 'menu.shipments',
            'Discounts': 'menu.discounts',
            'Customers': 'menu.customers',
            'Reports': 'menu.reports',
            'Low Stock': 'menu.lowstock',
            'E-commerce Settings': 'menu.e-commercesettings',
            'Catalog': 'menu.catalog',
            'Brands': 'menu.brands',
            'Product Attributes': 'menu.productattributes',
            'Sales': 'menu.sales',
            'Content Management': 'menu.contentmanagement',
            'Settings': 'menu.settings',
            'Email Templates': 'menu.emailTemplates'
        };
        return items.map(item => {
            const translationKey = menuKeyMap[item.title] || `menu.${item.title.toLowerCase().replace(/\s+/g, '')}`;
            const translatedText = i18nService_1.i18nService.translate(translationKey, language) || item.title;
            const processedItem = {
                ...item,
                text: item.text || translatedText,
                roles: Array.isArray(item.roles) ? item.roles : [],
                children: item.children ? this.processMenuItems(item.children, language) : []
            };
            if (processedItem.children && processedItem.children.length > 0) {
                processedItem.children.sort((a, b) => a.order - b.order);
            }
            return processedItem;
        }).sort((a, b) => a.order - b.order);
    }
    async getAllMenuItems(language = 'en') {
        try {
            const menuData = this.readMenuData();
            return this.processMenuItems(menuData.menu, language);
        }
        catch (error) {
            console.error('Error fetching admin menu items:', error);
            return [];
        }
    }
    async getMenuItemById(id) {
        try {
            const menuData = this.readMenuData();
            const item = menuData.menu.find((item) => item.id === id);
            if (!item)
                return null;
            return {
                id: item.id,
                title: item.title,
                url: item.url,
                parentId: item.parentId,
                order: item.order,
                icon: item.icon,
                roles: Array.isArray(item.roles) ? item.roles : [],
                isVisible: item.isVisible !== false
            };
        }
        catch (error) {
            console.error('Error fetching admin menu item by ID:', error);
            return null;
        }
    }
    async createMenuItem(itemData) {
        try {
            const menuData = this.readMenuData();
            const maxId = menuData.menu.length > 0
                ? Math.max(...menuData.menu.map(item => item.id))
                : 0;
            const newId = maxId + 1;
            const newItem = {
                id: newId,
                title: itemData.title,
                text: itemData.title,
                url: itemData.url,
                parentId: itemData.parentId || null,
                order: itemData.order,
                icon: itemData.icon || '',
                roles: itemData.roles || [],
                isVisible: itemData.isVisible !== false
            };
            menuData.menu.push(newItem);
            this.writeMenuData(menuData);
            return {
                id: newId,
                title: itemData.title,
                url: itemData.url,
                parentId: itemData.parentId || null,
                order: itemData.order,
                icon: itemData.icon || '',
                roles: itemData.roles || [],
                isVisible: itemData.isVisible !== false
            };
        }
        catch (error) {
            console.error('Error creating admin menu item:', error);
            throw new Error('Failed to create admin menu item');
        }
    }
    async updateMenuItem(id, updates) {
        try {
            const menuData = this.readMenuData();
            const itemIndex = menuData.menu.findIndex((item) => item.id === id);
            if (itemIndex === -1)
                return null;
            const item = menuData.menu[itemIndex];
            if (updates.title !== undefined) {
                item.title = updates.title;
                item.text = updates.title;
            }
            if (updates.url !== undefined)
                item.url = updates.url;
            if (updates.parentId !== undefined)
                item.parentId = updates.parentId;
            if (updates.order !== undefined)
                item.order = updates.order;
            if (updates.icon !== undefined)
                item.icon = updates.icon;
            if (updates.roles !== undefined)
                item.roles = updates.roles;
            if (updates.isVisible !== undefined)
                item.isVisible = updates.isVisible;
            this.writeMenuData(menuData);
            return await this.getMenuItemById(id);
        }
        catch (error) {
            console.error('Error updating admin menu item:', error);
            return null;
        }
    }
    async deleteMenuItem(id) {
        try {
            const menuData = this.readMenuData();
            const initialLength = menuData.menu.length;
            menuData.menu = menuData.menu.filter((item) => {
                return item.id !== id && item.parentId !== id;
            });
            this.writeMenuData(menuData);
            return menuData.menu.length < initialLength;
        }
        catch (error) {
            console.error('Error deleting admin menu item:', error);
            return false;
        }
    }
    async getMenuForUser(userRole, language = 'en') {
        try {
            const items = await this.getAllMenuItems(language);
            return items.filter(item => item.isVisible &&
                (item.roles.length === 0 || item.roles.includes(userRole)));
        }
        catch (error) {
            console.error('Error fetching menu for user:', error);
            return [];
        }
    }
    urlMatches(itemUrl, currentUrl) {
        if (!currentUrl || !itemUrl || itemUrl === '#' || itemUrl === 'javascript:;') {
            return false;
        }
        const normalizeUrl = (url) => {
            return url.replace(/\/+$/, '') || '/';
        };
        const normalizedCurrent = normalizeUrl(currentUrl);
        const normalizedItemUrl = normalizeUrl(itemUrl);
        if (normalizedCurrent === normalizedItemUrl) {
            return true;
        }
        if (normalizedItemUrl !== '/' && normalizedCurrent.startsWith(normalizedItemUrl + '/')) {
            return true;
        }
        return false;
    }
    isCurrent(item, currentUrl) {
        if (!currentUrl)
            return false;
        if (item.url && this.urlMatches(item.url, currentUrl)) {
            return true;
        }
        if (item.children && item.children.length > 0) {
            for (const child of item.children) {
                if (this.isCurrent(child, currentUrl)) {
                    return true;
                }
            }
        }
        return false;
    }
    async getMenuWithCurrent(currentUrl, language = 'en') {
        const menu = await this.getAllMenuItems(language);
        const setCurrent = (items) => {
            items.forEach(item => {
                if (item.children && item.children.length > 0) {
                    setCurrent(item.children);
                }
                const itemUrlMatches = item.url && this.urlMatches(item.url, currentUrl);
                const hasCurrentChild = item.children && item.children.some((child) => child.current === true);
                item.current = itemUrlMatches || hasCurrentChild || false;
            });
        };
        setCurrent(menu);
        return menu;
    }
    async getMenu(language = 'en') {
        return await this.getAllMenuItems(language);
    }
}
exports.AdminMenuService = AdminMenuService;
exports.adminMenuService = AdminMenuService.getInstance();
//# sourceMappingURL=adminMenuService.js.map