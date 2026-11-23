"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesService = void 0;
const pagesService_1 = require("../../admin/services/pagesService");
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const menuService_1 = require("../../admin/services/menuService");
const adminPagesService = pagesService_1.PagesService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const menuService = menuService_1.MenuService.getInstance();
class PagesService {
    constructor() {
        this.cachedSettings = null;
        this.cachedMenus = new Map();
        this.cacheTime = 0;
        this.cacheDuration = 30000;
    }
    static getInstance() {
        if (!PagesService.instance) {
            PagesService.instance = new PagesService();
        }
        return PagesService.instance;
    }
    async loadCache() {
        const now = Date.now();
        if (!this.cachedSettings || (now - this.cacheTime) > this.cacheDuration) {
            this.cachedSettings = await siteSettingsService.getAllSettings();
            const menus = await menuService.getAllMenus();
            this.cachedMenus.clear();
            for (const menu of menus) {
                if (menu.items && menu.items.length > 0) {
                    const convertedItems = await this.convertMenuItems(menu.items);
                    this.cachedMenus.set(menu.name, convertedItems);
                }
            }
            this.cacheTime = now;
        }
    }
    async convertMenuItems(items) {
        return await Promise.all(items.map(async (item) => {
            let url = item.link ? (item.link.startsWith('/') ? item.link : `/${item.link}`) : `/${item.id}`;
            const key = url.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
            let displayTitle = item.title;
            if (item.type === 'page' && item.link && item.link.trim() !== '') {
                try {
                    const slug = item.link.replace(/^\/|\/$/g, '').trim();
                    if (slug && slug !== 'home') {
                        const page = await adminPagesService.getPageBySlug(slug);
                        if (page && page.title) {
                            displayTitle = page.title;
                        }
                    }
                }
                catch (error) {
                    console.error(`Error fetching page title for slug "${item.link}":`, error);
                }
            }
            return {
                key: key,
                title: displayTitle,
                url: url,
                id: item.id,
                active: item.active,
                children: item.children ? await this.convertMenuItems(item.children) : []
            };
        }));
    }
    async getAllPages() {
        return await adminPagesService.getPublishedPages();
    }
    async getPageBySlug(slug) {
        const page = await adminPagesService.getPageBySlug(slug);
        if (page && page.status === 'published') {
            return page;
        }
        return null;
    }
    async getPageById(id) {
        const page = await adminPagesService.getPageById(id);
        if (page && page.status === 'published') {
            return page;
        }
        return null;
    }
    getPagesData() {
        return {
            pages: {},
            site: this.getSiteData()
        };
    }
    getMenuItems() {
        return this.getMenu('Main Menu');
    }
    getMenu(name) {
        return this.cachedMenus.get(name) || [];
    }
    getPageData(pageKey) {
        return null;
    }
    getSiteData() {
        const settings = this.cachedSettings || {};
        return {
            name: settings.siteTitle || '',
            domain: settings.siteUrl || '',
            description: settings.siteDescription || '',
            logo: settings.logo || '/images/logo.png',
            favicon: settings.favicon || '/images/favicon.ico',
            email: settings.contactEmail || '',
            phone: settings.contactPhone || '',
            whatsapp: settings.contactWhatsapp || '',
            address: settings.address || '',
            social: {
                linkedin: settings.socialMedia?.linkedin || '',
                facebook: settings.socialMedia?.facebook || ''
            }
        };
    }
    getSeoData(pageKey, customData) {
        const settings = this.cachedSettings || {};
        const siteData = this.getSiteData();
        return {
            pageTitle: customData?.pageTitle || settings.seo?.defaultTitle || siteData.name,
            pageDescription: customData?.pageDescription || settings.seo?.defaultDescription || siteData.description,
            pageKeywords: customData?.pageKeywords || settings.seo?.defaultKeywords || '',
            pageUrl: customData?.pageUrl || siteData.domain,
            pageImage: customData?.pageImage || settings.siteImage || siteData.logo,
            pageType: customData?.pageType || 'website',
            pageRobots: customData?.pageRobots || 'index, follow'
        };
    }
    getPageKeyFromPath(path) {
        if (path === '/')
            return 'home';
        const cleanPath = path.replace(/^\/|\/$/g, '');
        return cleanPath.replace(/\//g, '-') || 'home';
    }
    async initialize() {
        await this.loadCache();
    }
    async reloadCache() {
        this.cachedSettings = null;
        this.cacheTime = 0;
        await this.loadCache();
    }
}
exports.PagesService = PagesService;
const instance = PagesService.getInstance();
exports.default = instance;
//# sourceMappingURL=pagesService.js.map