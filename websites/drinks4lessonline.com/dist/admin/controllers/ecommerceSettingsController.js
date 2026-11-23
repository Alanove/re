"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcommerceSettingsController = void 0;
const siteSettingsService_1 = require("../services/siteSettingsService");
const ecommerceSettingsService_1 = require("../services/ecommerceSettingsService");
const i18nService_1 = require("../services/i18nService");
const shippingService_1 = __importDefault(require("../../src/services/shippingService"));
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const ecommerceSettingsService = ecommerceSettingsService_1.EcommerceSettingsService.getInstance();
class EcommerceSettingsController {
    static getAramexDefaults() {
        return {
            aramex_username: process.env.ARAMEX_USERNAME || process.env.ARAMEX_USER_NAME || 'info@guerrasports.com',
            aramex_password: process.env.ARAMEX_PASSWORD || '',
            aramex_shipper: {
                name: process.env.ARAMEX_SHIPPER_NAME || 'Guerra Sports',
                company: process.env.ARAMEX_SHIPPER_COMPANY || 'Skyline Group LLC',
                address: process.env.ARAMEX_SHIPPER_ADDRESS || 'Okaibe Highway',
                city: process.env.ARAMEX_SHIPPER_CITY || 'Tabarja',
                state: process.env.ARAMEX_SHIPPER_STATE || 'Keserwan',
                postalcode: process.env.ARAMEX_SHIPPER_POSTALCODE || '0000',
                country: process.env.ARAMEX_SHIPPER_COUNTRY || 'LB',
                phone: process.env.ARAMEX_SHIPPER_PHONE || '+961 3446411',
                email: process.env.ARAMEX_SHIPPER_EMAIL || 'info@guerrasports.com'
            },
            aramex_account_number: process.env.ARAMEX_ACCOUNT_NUMBER || '72478367',
            aramex_account_entity: process.env.ARAMEX_ACCOUNT_ENTITY || 'BEY',
            aramex_account_country_code: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || 'LB',
            aramex_account_pin: process.env.ARAMEX_ACCOUNT_PIN || ''
        };
    }
    static async index(req, res) {
        try {
            const settings = await ecommerceSettingsService.getSettings();
            const defaults = EcommerceSettingsController.getAramexDefaults();
            if (!settings.aramex_username)
                settings.aramex_username = defaults.aramex_username;
            if (!settings.aramex_password)
                settings.aramex_password = defaults.aramex_password;
            if (!settings.aramex_account_number)
                settings.aramex_account_number = defaults.aramex_account_number;
            if (!settings.aramex_account_entity)
                settings.aramex_account_entity = defaults.aramex_account_entity;
            if (!settings.aramex_account_country_code)
                settings.aramex_account_country_code = defaults.aramex_account_country_code;
            if (settings.aramex_shipper) {
                const s = settings.aramex_shipper;
                settings.aramex_shipper = {
                    name: s.name || defaults.aramex_shipper.name,
                    company: s.company || defaults.aramex_shipper.company,
                    address: s.address || defaults.aramex_shipper.address,
                    city: s.city || defaults.aramex_shipper.city,
                    state: s.state || defaults.aramex_shipper.state,
                    postalcode: s.postalcode || defaults.aramex_shipper.postalcode,
                    country: s.country || defaults.aramex_shipper.country,
                    phone: s.phone || defaults.aramex_shipper.phone,
                    email: s.email || defaults.aramex_shipper.email
                };
            }
            else {
                settings.aramex_shipper = defaults.aramex_shipper;
            }
            const shippingZones = await ecommerceSettingsService.getAllShippingZones();
            const paymentMethods = await ecommerceSettingsService.getPaymentMethods();
            const zonesWithRates = await Promise.all(shippingZones.map(async (zone) => {
                const rates = await ecommerceSettingsService.getShippingRatesForZone(zone.id);
                return {
                    ...zone,
                    countries: typeof zone.countries === 'string' ? JSON.parse(zone.countries) : zone.countries,
                    rates
                };
            }));
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('ecommerce-settings/settings', {
                title: 'E-commerce Settings',
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.settings.title') : 'E-commerce Settings',
                siteTitle,
                t,
                settings,
                shippingZones: zonesWithRates,
                paymentMethods
            });
        }
        catch (error) {
            console.error('Error rendering e-commerce settings page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async updateSettings(req, res) {
        try {
            const settings = {
                store_name: req.body.store_name,
                store_email: req.body.store_email,
                store_phone: req.body.store_phone,
                store_address: req.body.store_address,
                currency: req.body.currency,
                currency_symbol: req.body.currency_symbol,
                tax_enabled: req.body.tax_enabled === 'true' || req.body.tax_enabled === 'on',
                tax_rate: req.body.tax_rate ? parseFloat(req.body.tax_rate) : 0,
                default_shipping_zone: req.body.default_shipping_zone ? parseInt(req.body.default_shipping_zone) : null,
                shipping_zones_enabled: req.body.shipping_zones_enabled === 'true' || req.body.shipping_zones_enabled === 'on',
                shipping_methods: Array.isArray(req.body.shipping_methods) ? req.body.shipping_methods : (req.body.shipping_methods ? [req.body.shipping_methods] : []),
                shipping_test_mode: req.body.shipping_test_mode === 'true' || req.body.shipping_test_mode === 'on',
                aramex_shipper: {
                    name: req.body.aramex_shipper_name || undefined,
                    company: req.body.aramex_shipper_company || undefined,
                    address: req.body.aramex_shipper_address || undefined,
                    city: req.body.aramex_shipper_city || undefined,
                    state: req.body.aramex_shipper_state || undefined,
                    postalcode: req.body.aramex_shipper_postalcode || undefined,
                    country: req.body.aramex_shipper_country || undefined,
                    phone: req.body.aramex_shipper_phone || undefined,
                    email: req.body.aramex_shipper_email || undefined
                },
                aramex_account_entity: req.body.aramex_account_entity || undefined,
                aramex_account_country_code: req.body.aramex_account_country_code || undefined,
                aramex_account_number: req.body.aramex_account_number || undefined,
                aramex_account_pin: (req.body.aramex_account_pin && String(req.body.aramex_account_pin).trim()) ? req.body.aramex_account_pin : undefined,
                aramex_username: req.body.aramex_username || undefined,
                aramex_password: (req.body.aramex_password && String(req.body.aramex_password).trim()) ? req.body.aramex_password : undefined,
                multi_price_display: (() => {
                    const m = String(req.body.multi_price_display || 'lowest');
                    if (m === 'starting' || m === 'range' || m === 'lowest') {
                        return m;
                    }
                    return 'lowest';
                })(),
                facebook_app_id: String(req.body.facebook_app_id ?? '')
                    .replace(/\D/g, '')
                    .trim()
            };
            await ecommerceSettingsService.updateSettings(settings);
            res.redirect('/admin/ecommerce-settings?success=Settings updated successfully');
        }
        catch (error) {
            console.error('Error updating settings:', error);
            res.redirect(`/admin/ecommerce-settings?error=${encodeURIComponent(error.message || 'Failed to update settings')}`);
        }
    }
    static async createShippingZone(req, res) {
        try {
            const countries = Array.isArray(req.body.countries)
                ? req.body.countries
                : (req.body.countries ? JSON.parse(req.body.countries) : []);
            const zone = await ecommerceSettingsService.createShippingZone({
                name: req.body.name,
                description: req.body.description,
                countries,
                is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off'
            });
            res.json({ success: true, zone });
        }
        catch (error) {
            console.error('Error creating shipping zone:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to create shipping zone' });
        }
    }
    static async updateShippingZone(req, res) {
        try {
            const zoneId = parseInt(req.params.id);
            const updateData = {};
            if (req.body.name)
                updateData.name = req.body.name;
            if (req.body.description !== undefined)
                updateData.description = req.body.description;
            if (req.body.countries) {
                updateData.countries = Array.isArray(req.body.countries)
                    ? req.body.countries
                    : JSON.parse(req.body.countries);
            }
            if (req.body.is_active !== undefined) {
                updateData.is_active = req.body.is_active !== 'false' && req.body.is_active !== 'off';
            }
            await ecommerceSettingsService.updateShippingZone(zoneId, updateData);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating shipping zone:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update shipping zone' });
        }
    }
    static async deleteShippingZone(req, res) {
        try {
            const zoneId = parseInt(req.params.id);
            await ecommerceSettingsService.deleteShippingZone(zoneId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting shipping zone:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete shipping zone' });
        }
    }
    static async createShippingRate(req, res) {
        try {
            const rate = await ecommerceSettingsService.createShippingRate({
                zone_id: parseInt(req.body.zone_id),
                name: req.body.name,
                description: req.body.description,
                method: req.body.method,
                base_rate: parseFloat(req.body.base_rate),
                per_item_rate: req.body.per_item_rate ? parseFloat(req.body.per_item_rate) : 0,
                per_weight_rate: req.body.per_weight_rate ? parseFloat(req.body.per_weight_rate) : 0,
                free_shipping_threshold: req.body.free_shipping_threshold ? parseFloat(req.body.free_shipping_threshold) : null,
                min_order_amount: req.body.min_order_amount ? parseFloat(req.body.min_order_amount) : null,
                max_order_amount: req.body.max_order_amount ? parseFloat(req.body.max_order_amount) : null,
                estimated_days: req.body.estimated_days ? parseInt(req.body.estimated_days) : null,
                is_active: req.body.is_active !== 'false' && req.body.is_active !== 'off',
                order_index: req.body.order_index ? parseInt(req.body.order_index) : 0
            });
            res.json({ success: true, rate });
        }
        catch (error) {
            console.error('Error creating shipping rate:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to create shipping rate' });
        }
    }
    static async updateShippingRate(req, res) {
        try {
            const rateId = parseInt(req.params.id);
            const updateData = {};
            if (req.body.name)
                updateData.name = req.body.name;
            if (req.body.description !== undefined)
                updateData.description = req.body.description;
            if (req.body.method)
                updateData.method = req.body.method;
            if (req.body.base_rate !== undefined)
                updateData.base_rate = parseFloat(req.body.base_rate);
            if (req.body.per_item_rate !== undefined)
                updateData.per_item_rate = parseFloat(req.body.per_item_rate);
            if (req.body.per_weight_rate !== undefined)
                updateData.per_weight_rate = parseFloat(req.body.per_weight_rate);
            if (req.body.free_shipping_threshold !== undefined) {
                updateData.free_shipping_threshold = req.body.free_shipping_threshold ? parseFloat(req.body.free_shipping_threshold) : null;
            }
            if (req.body.min_order_amount !== undefined) {
                updateData.min_order_amount = req.body.min_order_amount ? parseFloat(req.body.min_order_amount) : null;
            }
            if (req.body.max_order_amount !== undefined) {
                updateData.max_order_amount = req.body.max_order_amount ? parseFloat(req.body.max_order_amount) : null;
            }
            if (req.body.estimated_days !== undefined) {
                updateData.estimated_days = req.body.estimated_days ? parseInt(req.body.estimated_days) : null;
            }
            if (req.body.is_active !== undefined) {
                updateData.is_active = req.body.is_active !== 'false' && req.body.is_active !== 'off';
            }
            if (req.body.order_index !== undefined) {
                updateData.order_index = parseInt(req.body.order_index);
            }
            await ecommerceSettingsService.updateShippingRate(rateId, updateData);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating shipping rate:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update shipping rate' });
        }
    }
    static async deleteShippingRate(req, res) {
        try {
            const rateId = parseInt(req.params.id);
            await ecommerceSettingsService.deleteShippingRate(rateId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting shipping rate:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete shipping rate' });
        }
    }
    static async updatePaymentMethod(req, res) {
        try {
            const methodId = parseInt(req.params.id);
            const updateData = {};
            if (req.body.name)
                updateData.name = req.body.name;
            if (req.body.description !== undefined)
                updateData.description = req.body.description;
            if (req.body.is_active !== undefined) {
                updateData.is_active = req.body.is_active === true || req.body.is_active === 'true' || req.body.is_active === 'on';
            }
            if (req.body.config) {
                try {
                    updateData.config = typeof req.body.config === 'string'
                        ? JSON.parse(req.body.config)
                        : req.body.config;
                }
                catch (e) {
                    updateData.config = req.body.config;
                }
            }
            await ecommerceSettingsService.updatePaymentMethod(methodId, updateData);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating payment method:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update payment method' });
        }
    }
    static async testAramexShipping(req, res) {
        try {
            const country = (req.body.country || req.query.country || 'LB').toString().trim().toUpperCase().slice(0, 2);
            const city = (req.body.city ?? req.query.city ?? 'Beirut').toString().trim();
            const state = (req.body.state ?? req.query.state ?? '').toString().trim();
            const postcode = (req.body.postcode ?? req.query.postcode ?? '').toString().trim();
            const weightKg = parseFloat((req.body.weightKg ?? req.body.weight ?? req.query.weightKg ?? req.query.weight ?? '1.5').toString()) || 1.5;
            const result = await shippingService_1.default.testAramexShipping({ country, city, state, postcode }, weightKg);
            res.json(result);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const message = err.message || 'Unknown error';
            const details = err.stack || '';
            const debug = error?.debug;
            console.error('Test Aramex shipping error:', err);
            res.status(500).json({
                success: false,
                error: message,
                details: details,
                ...(debug && { debug })
            });
        }
    }
}
exports.EcommerceSettingsController = EcommerceSettingsController;
//# sourceMappingURL=ecommerceSettingsController.js.map