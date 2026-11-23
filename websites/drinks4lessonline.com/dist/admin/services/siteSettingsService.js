"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettingsService = void 0;
const database_1 = require("../../src/config/database");
class SiteSettingsService {
    constructor() {
        this.settingsCache = null;
        this.cacheTime = 0;
        this.cacheDuration = 5000;
    }
    static getInstance() {
        if (!SiteSettingsService.instance) {
            SiteSettingsService.instance = new SiteSettingsService();
        }
        return SiteSettingsService.instance;
    }
    async loadSettings() {
        if (this.settingsCache && (Date.now() - this.cacheTime) < this.cacheDuration) {
            return this.settingsCache;
        }
        try {
            const [rows] = await database_1.db.query(`
        SELECT setting_key, setting_value, setting_type
        FROM site_settings
      `);
            const settings = {};
            for (const row of rows) {
                const key = row.setting_key;
                let value = row.setting_value;
                if (row.setting_type === 'object' || (value && (value.startsWith('{') || value.startsWith('[')))) {
                    try {
                        value = JSON.parse(value);
                    }
                    catch (e) {
                    }
                }
                settings[key] = value;
            }
            this.settingsCache = { ...this.getDefaultSettings(), ...settings };
            this.cacheTime = Date.now();
            return this.settingsCache;
        }
        catch (error) {
            console.error('Error loading site settings:', error);
            return this.getDefaultSettings();
        }
    }
    async saveSetting(key, value) {
        try {
            const settingType = typeof value;
            const settingValue = typeof value === 'string' ? value : JSON.stringify(value);
            const [result] = await database_1.db.query(`
        UPDATE site_settings 
        SET setting_value = ?, setting_type = ?
        WHERE setting_key = ?
      `, [settingValue, settingType, key]);
            if (result.affectedRows === 0) {
                await database_1.db.query(`
          INSERT INTO site_settings (setting_key, setting_value, setting_type)
          VALUES (?, ?, ?)
        `, [key, settingValue, settingType]);
            }
            this.settingsCache = null;
        }
        catch (error) {
            console.error('Error saving setting:', error);
            throw error;
        }
    }
    getDefaultSettings() {
        return {
            siteTitle: '',
            siteSlogan: '',
            siteDescription: '',
            logo: '/images/logo.jpg',
            favicon: '/images/favicon.ico',
            siteImage: '/images/site-image.jpg',
            siteUrl: '',
            contactEmail: '',
            contactPhone: '',
            contactWhatsapp: '',
            address: '',
            socialMedia: {
                facebook: '',
                twitter: '',
                instagram: '',
                linkedin: '',
                youtube: ''
            },
            seo: {
                defaultTitle: '',
                defaultDescription: '',
                defaultKeywords: ''
            },
            downloadLinks: {
                portfolio: '',
                brochure: '',
                catalog: ''
            },
            googleMaps: {
                embedUrl: '',
                directionsUrl: '',
                latitude: '',
                longitude: ''
            },
            analyticsScript: ''
        };
    }
    async getAllSettings() {
        return await this.loadSettings();
    }
    async getSiteTitle() {
        const settings = await this.loadSettings();
        return settings.siteTitle;
    }
    async getSiteDescription() {
        const settings = await this.loadSettings();
        return settings.siteDescription;
    }
    async getSiteUrl() {
        const settings = await this.loadSettings();
        return settings.siteUrl;
    }
    async getContactEmail() {
        const settings = await this.loadSettings();
        return settings.contactEmail;
    }
    async getContactPhone() {
        const settings = await this.loadSettings();
        return settings.contactPhone;
    }
    async getContactWhatsapp() {
        const settings = await this.loadSettings();
        return settings.contactWhatsapp || '';
    }
    async getAddress() {
        const settings = await this.loadSettings();
        return settings.address;
    }
    async getSocialMedia() {
        const settings = await this.loadSettings();
        return settings.socialMedia;
    }
    async getSeoSettings() {
        const settings = await this.loadSettings();
        return settings.seo;
    }
    async getDownloadLinks() {
        const settings = await this.loadSettings();
        return settings.downloadLinks;
    }
    async getGoogleMapsSettings() {
        const settings = await this.loadSettings();
        return settings.googleMaps;
    }
    async updateSettings(newSettings) {
        try {
            for (const [key, value] of Object.entries(newSettings)) {
                await this.saveSetting(key, value);
            }
            this.settingsCache = null;
            return true;
        }
        catch (error) {
            console.error('Error updating site settings:', error);
            return false;
        }
    }
    reloadSettings() {
        this.settingsCache = null;
        this.cacheTime = 0;
    }
}
exports.SiteSettingsService = SiteSettingsService;
//# sourceMappingURL=siteSettingsService.js.map