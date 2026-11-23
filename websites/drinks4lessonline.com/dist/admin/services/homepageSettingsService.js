"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomepageSettingsService = exports.DEFAULT_SALE_META_DESCRIPTION = exports.DEFAULT_SALE_TITLE = exports.DEFAULT_NEW_ARRIVALS_TITLE = exports.DEFAULT_HOMEPAGE_BANNER_LINK = exports.DEFAULT_HOMEPAGE_BANNER_TEXT = exports.DEFAULT_HOMEPAGE_BANNER_IMAGE = void 0;
exports.cleanHomepageLink = cleanHomepageLink;
const database_1 = require("../../src/config/database");
exports.DEFAULT_HOMEPAGE_BANNER_IMAGE = '/images/Firefly-2.jpg';
exports.DEFAULT_HOMEPAGE_BANNER_TEXT = 'SHOP GUERRA PRODUCTS';
exports.DEFAULT_HOMEPAGE_BANNER_LINK = '/products';
exports.DEFAULT_NEW_ARRIVALS_TITLE = 'New Arrivals';
exports.DEFAULT_SALE_TITLE = 'Sale';
exports.DEFAULT_SALE_META_DESCRIPTION = 'Shop products currently on sale at Drinks4Less.';
const KEYS = {
    bannerImage: 'homepage_banner_image',
    bannerText: 'homepage_banner_text',
    bannerLink: 'homepage_banner_link',
    newArrivalsTitle: 'homepage_new_arrivals_title',
    saleTitle: 'homepage_sale_title',
    saleEnabled: 'homepage_sale_enabled',
    saleMetaTitle: 'homepage_sale_meta_title',
    saleMetaDescription: 'homepage_sale_meta_description'
};
function cleanText(value, fallback) {
    const text = value == null ? '' : String(value).trim();
    return text || fallback;
}
function cleanHomepageLink(value, fallback = exports.DEFAULT_HOMEPAGE_BANNER_LINK) {
    const text = value == null ? '' : String(value).trim();
    if (!text)
        return fallback;
    if (text.startsWith('/') && !text.startsWith('//'))
        return text;
    try {
        const url = new URL(text);
        if (url.protocol === 'http:' || url.protocol === 'https:')
            return text;
    }
    catch {
    }
    return fallback;
}
class HomepageSettingsService {
    constructor() { }
    static getInstance() {
        if (!HomepageSettingsService.instance) {
            HomepageSettingsService.instance = new HomepageSettingsService();
        }
        return HomepageSettingsService.instance;
    }
    async getSettings() {
        const defaults = {
            bannerImage: exports.DEFAULT_HOMEPAGE_BANNER_IMAGE,
            bannerText: exports.DEFAULT_HOMEPAGE_BANNER_TEXT,
            bannerLink: exports.DEFAULT_HOMEPAGE_BANNER_LINK,
            newArrivalsTitle: exports.DEFAULT_NEW_ARRIVALS_TITLE,
            saleTitle: exports.DEFAULT_SALE_TITLE,
            saleEnabled: true,
            saleMetaTitle: '',
            saleMetaDescription: ''
        };
        try {
            const [rows] = await database_1.db.query(`SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE 'homepage_%'`);
            const map = {};
            rows.forEach((row) => {
                map[row.setting_key] = row.setting_value == null ? '' : String(row.setting_value);
            });
            const hasEnabled = Object.prototype.hasOwnProperty.call(map, KEYS.saleEnabled);
            const enabledRaw = (map[KEYS.saleEnabled] || '').trim().toLowerCase();
            return {
                bannerImage: cleanText(map[KEYS.bannerImage], defaults.bannerImage),
                bannerText: cleanText(map[KEYS.bannerText], defaults.bannerText),
                bannerLink: cleanHomepageLink(map[KEYS.bannerLink], defaults.bannerLink),
                newArrivalsTitle: cleanText(map[KEYS.newArrivalsTitle], defaults.newArrivalsTitle),
                saleTitle: cleanText(map[KEYS.saleTitle], defaults.saleTitle),
                saleEnabled: hasEnabled ? enabledRaw !== 'false' && enabledRaw !== '0' : true,
                saleMetaTitle: (map[KEYS.saleMetaTitle] || '').trim(),
                saleMetaDescription: (map[KEYS.saleMetaDescription] || '').trim()
            };
        }
        catch (error) {
            console.error('Error loading homepage settings:', error);
            return defaults;
        }
    }
    async updateSettings(settings) {
        const entries = [];
        if (settings.bannerImage !== undefined)
            entries.push([KEYS.bannerImage, settings.bannerImage]);
        if (settings.bannerText !== undefined)
            entries.push([KEYS.bannerText, settings.bannerText]);
        if (settings.bannerLink !== undefined)
            entries.push([KEYS.bannerLink, settings.bannerLink]);
        if (settings.newArrivalsTitle !== undefined)
            entries.push([KEYS.newArrivalsTitle, settings.newArrivalsTitle]);
        if (settings.saleTitle !== undefined)
            entries.push([KEYS.saleTitle, settings.saleTitle]);
        if (settings.saleEnabled !== undefined)
            entries.push([KEYS.saleEnabled, settings.saleEnabled ? 'true' : 'false']);
        if (settings.saleMetaTitle !== undefined)
            entries.push([KEYS.saleMetaTitle, settings.saleMetaTitle]);
        if (settings.saleMetaDescription !== undefined)
            entries.push([KEYS.saleMetaDescription, settings.saleMetaDescription]);
        for (const [settingKey, settingValue] of entries) {
            await database_1.db.query(`INSERT INTO site_settings (setting_key, setting_value, setting_type, updated_at)
         VALUES (?, ?, 'string', NOW())
         ON DUPLICATE KEY UPDATE setting_value = ?, setting_type = 'string', updated_at = NOW()`, [settingKey, settingValue, settingValue]);
        }
    }
}
exports.HomepageSettingsService = HomepageSettingsService;
//# sourceMappingURL=homepageSettingsService.js.map