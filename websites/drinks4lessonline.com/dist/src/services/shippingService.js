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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingService = void 0;
const fs = __importStar(require("fs"));
const database_1 = require("../config/database");
const data_paths_1 = require("../constants/data-paths");
const loggerService_1 = __importDefault(require("./loggerService"));
const aramex_1 = require("../aramex");
class ShippingService {
    constructor() { }
    static getInstance() {
        if (!ShippingService.instance) {
            ShippingService.instance = new ShippingService();
        }
        return ShippingService.instance;
    }
    async getShippingZoneForCountry(country) {
        try {
            const normalized = (country || '').trim().toUpperCase();
            if (!normalized)
                return null;
            const [rows] = await database_1.db.query('SELECT * FROM shipping_zones WHERE is_active = TRUE');
            for (const zone of rows) {
                const countries = JSON.parse(zone.countries || '[]');
                const match = Array.isArray(countries) && countries.some((c) => String(c).trim().toUpperCase() === normalized);
                if (match)
                    return zone;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting shipping zone for country:', error);
            return null;
        }
    }
    async getShippingZoneById(zoneId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_zones WHERE id = ? AND is_active = TRUE', [zoneId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting shipping zone by id:', error);
            return null;
        }
    }
    async getShippingRatesForZone(zoneId) {
        try {
            const [rows] = await database_1.db.query(`SELECT * FROM shipping_rates 
        WHERE zone_id = ? AND is_active = TRUE 
        ORDER BY order_index ASC, id ASC`, [zoneId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting shipping rates for zone:', error);
            throw error;
        }
    }
    async getAvailableShippingRates(cartData) {
        try {
            const calculations = [];
            const settings = await this.getShippingSettings();
            let carrierFailed = false;
            const countryCode = this.normalizeCountryCode(cartData.country);
            const stateCode = (cartData.state || '').trim().toUpperCase();
            const zoneKey = countryCode === 'LB' && stateCode ? `LB:${stateCode}` : countryCode;
            if (settings.zonesEnabled && settings.methods.includes('custom')) {
                let zone = await this.getShippingZoneForCountry(zoneKey);
                if (!zone)
                    zone = await this.getShippingZoneForCountry(countryCode);
                if (!zone && settings.defaultShippingZoneId) {
                    zone = await this.getShippingZoneById(settings.defaultShippingZoneId);
                }
                if (zone) {
                    const rates = await this.getShippingRatesForZone(zone.id);
                    for (const rate of rates) {
                        if (!rate.is_active)
                            continue;
                        if (rate.min_order_amount !== null && cartData.subtotal < rate.min_order_amount) {
                            continue;
                        }
                        if (rate.max_order_amount !== null && cartData.subtotal > rate.max_order_amount) {
                            continue;
                        }
                        if (rate.free_shipping_threshold !== null && cartData.subtotal >= rate.free_shipping_threshold) {
                            calculations.push({
                                rate,
                                cost: 0,
                                estimatedDays: rate.estimated_days
                            });
                            continue;
                        }
                        let cost = rate.base_rate;
                        if (rate.method === 'weight_based') {
                            cost += cartData.totalWeight * rate.per_weight_rate;
                        }
                        else if (rate.method === 'price_based') {
                            cost += cartData.subtotal * (rate.per_weight_rate / 100);
                        }
                        cost += cartData.itemCount * rate.per_item_rate;
                        const weight = Number(cartData.totalWeight) || 0;
                        const isPickup = /pickup/i.test(rate.name || '');
                        if (!isPickup && weight > 20) {
                            cost += (weight - 20) * 0.15;
                        }
                        calculations.push({
                            rate,
                            cost: Math.max(0, cost),
                            estimatedDays: rate.estimated_days
                        });
                    }
                }
            }
            if (countryCode) {
                try {
                    const destCity = (cartData.city || '').trim();
                    const destinationCity = destCity || this.getDefaultCityForRate(countryCode);
                    if (process.env.NODE_ENV === 'development') {
                        process.stdout.write(`[Aramex] Fetching rates for ${countryCode} / ${destinationCity} ...\n`);
                    }
                    const clientInfo = (0, aramex_1.getClientInfo)();
                    const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
                    const destCountry = countryCode;
                    const isDomestic = shipperCountry === destCountry;
                    const shipper = settings.aramexShipper;
                    const originCity = (shipper?.city || process.env.ARAMEX_SHIPPER_CITY || 'Beirut').trim();
                    const originCountry = (shipper?.country || clientInfo.AccountCountryCode || 'LB').trim().toUpperCase();
                    const weight = Math.max(0.5, cartData.totalWeight || 0.5);
                    const productGroup = isDomestic ? 'DOM' : 'EXP';
                    const productType = isDomestic ? 'CDS' : 'PPX';
                    const result = await (0, aramex_1.calculateRateJson)({
                        originAddress: {
                            Line1: (shipper?.address || '').trim() || 'Origin',
                            City: originCity,
                            StateOrProvinceCode: (shipper?.state || '').trim() || '',
                            PostCode: (shipper?.postalcode || '').replace(/\s/g, '') || '',
                            CountryCode: originCountry
                        },
                        destinationAddress: {
                            Line1: '',
                            City: destinationCity,
                            StateOrProvinceCode: (cartData.state || '').trim() || '',
                            PostCode: (cartData.postal_code || '').replace(/\s/g, '') || '',
                            CountryCode: destCountry
                        },
                        shipmentDetails: {
                            ActualWeight: { Unit: 'KG', Value: weight },
                            ChargeableWeight: { Unit: 'KG', Value: weight },
                            Dimensions: null,
                            NumberOfPieces: Math.max(1, cartData.items?.length || 1),
                            ProductGroup: productGroup,
                            ProductType: productType,
                            PaymentType: 'P',
                            PaymentOptions: '',
                            GoodsOriginCountry: originCountry,
                            DescriptionOfGoods: null,
                            CustomsValueAmount: null,
                            CashOnDeliveryAmount: null,
                            Services: ''
                        },
                        preferredCurrencyCode: process.env.ARAMEX_CURRENCY || 'USD'
                    });
                    if (!result.HasErrors && result.TotalAmount != null) {
                        const cost = Math.round(Number(result.TotalAmount.Value));
                        const currency = result.TotalAmount.CurrencyCode || 'USD';
                        calculations.push({
                            rate: {
                                id: 9999,
                                zone_id: 0,
                                name: `Aramex ${productType}`,
                                description: `Fast delivery via Aramex (${productType})`,
                                method: 'weight_based',
                                base_rate: cost,
                                per_item_rate: 0,
                                per_weight_rate: 0,
                                free_shipping_threshold: null,
                                min_order_amount: null,
                                max_order_amount: null,
                                estimated_days: 5,
                                is_active: true,
                                order_index: 99,
                                created_at: new Date(),
                                updated_at: new Date()
                            },
                            cost,
                            estimatedDays: 5
                        });
                    }
                    else {
                        const notifs = result.Notifications?.Notification;
                        const list = notifs == null ? [] : Array.isArray(notifs) ? notifs : [notifs];
                        const messages = list.map((n) => `${n?.Code || ''}: ${n?.Message || ''}`.trim()).filter(Boolean);
                        const msg = result.HasErrors
                            ? `Aramex CalculateRate errors for ${destCountry}/${destinationCity}: ${messages.length ? messages.join('; ') : JSON.stringify(result.Notifications)}`
                            : `Aramex CalculateRate no rate for ${destCountry}/${destinationCity} (TotalAmount missing or HasErrors): ${JSON.stringify(result)}`;
                        loggerService_1.default.error('ShippingService', msg);
                        console.error('[Aramex shipping]', msg);
                        if (result.HasErrors)
                            carrierFailed = true;
                    }
                }
                catch (error) {
                    carrierFailed = true;
                    const msg = `Failed to fetch Aramex rates: ${error instanceof Error ? error.message : String(error)}`;
                    loggerService_1.default.error('ShippingService', msg);
                    console.error('[Aramex shipping]', msg);
                }
            }
            const rates = calculations.sort((a, b) => a.cost - b.cost);
            if (rates.length === 0 && carrierFailed) {
                return { rates, ratesError: 'carrier_unavailable' };
            }
            return { rates };
        }
        catch (error) {
            console.error('Error getting available shipping rates:', error);
            throw error;
        }
    }
    async getShippingSettings() {
        try {
            const [rows] = await database_1.db.query(`SELECT setting_key, setting_value FROM site_settings 
         WHERE setting_key IN (
           'ecommerce_shipping_zones_enabled',
           'ecommerce_shipping_methods',
           'ecommerce_shipping_test_mode',
           'ecommerce_default_shipping_zone',
           'ecommerce_aramex_shipper',
           'ecommerce_aramex_account_entity',
           'ecommerce_aramex_account_country_code',
           'ecommerce_aramex_account_number',
           'ecommerce_aramex_account_pin',
           'ecommerce_aramex_username',
           'ecommerce_aramex_password'
         )`);
            let zonesEnabled = true;
            let methods = ['custom'];
            let shippingTestMode = false;
            let defaultShippingZoneId = null;
            let aramexShipper;
            let aramexAccountEntity;
            let aramexAccountCountryCode;
            let aramexAccountNumber;
            let aramexAccountPin;
            let aramexUsername;
            let aramexPassword;
            rows.forEach((row) => {
                if (row.setting_key === 'ecommerce_shipping_zones_enabled') {
                    zonesEnabled = row.setting_value === 'true';
                }
                if (row.setting_key === 'ecommerce_shipping_methods') {
                    try {
                        methods = JSON.parse(row.setting_value);
                        if (!Array.isArray(methods))
                            methods = [];
                    }
                    catch (e) {
                        methods = [];
                    }
                }
                if (row.setting_key === 'ecommerce_shipping_test_mode') {
                    shippingTestMode = row.setting_value === 'true';
                }
                if (row.setting_key === 'ecommerce_default_shipping_zone' && row.setting_value && row.setting_value !== 'null') {
                    const v = parseInt(row.setting_value, 10);
                    if (!isNaN(v))
                        defaultShippingZoneId = v;
                }
                if (row.setting_key === 'ecommerce_aramex_shipper' && row.setting_value && row.setting_value !== 'null') {
                    try {
                        aramexShipper = JSON.parse(row.setting_value);
                    }
                    catch (e) {
                        aramexShipper = undefined;
                    }
                }
                if (row.setting_key === 'ecommerce_aramex_account_entity') {
                    aramexAccountEntity = row.setting_value || undefined;
                }
                if (row.setting_key === 'ecommerce_aramex_account_country_code') {
                    aramexAccountCountryCode = row.setting_value || undefined;
                }
                if (row.setting_key === 'ecommerce_aramex_account_number') {
                    aramexAccountNumber = row.setting_value || undefined;
                }
                if (row.setting_key === 'ecommerce_aramex_account_pin') {
                    aramexAccountPin = row.setting_value || undefined;
                }
                if (row.setting_key === 'ecommerce_aramex_username') {
                    aramexUsername = row.setting_value || undefined;
                }
                if (row.setting_key === 'ecommerce_aramex_password') {
                    aramexPassword = row.setting_value || undefined;
                }
            });
            const result = {
                zonesEnabled,
                methods,
                shippingTestMode
            };
            if (defaultShippingZoneId !== null)
                result.defaultShippingZoneId = defaultShippingZoneId;
            if (aramexShipper !== undefined)
                result.aramexShipper = aramexShipper;
            if (aramexAccountEntity !== undefined)
                result.aramexAccountEntity = aramexAccountEntity;
            if (aramexAccountCountryCode !== undefined)
                result.aramexAccountCountryCode = aramexAccountCountryCode;
            if (aramexAccountNumber !== undefined)
                result.aramexAccountNumber = aramexAccountNumber;
            if (aramexAccountPin !== undefined)
                result.aramexAccountPin = aramexAccountPin;
            if (aramexUsername !== undefined)
                result.aramexUsername = aramexUsername;
            if (aramexPassword !== undefined)
                result.aramexPassword = aramexPassword;
            return result;
        }
        catch (error) {
            console.error('Error fetching shipping settings:', error);
            return { zonesEnabled: true, methods: ['custom'], shippingTestMode: false };
        }
    }
    buildAramexConfig(settings) {
        const userName = (settings.aramexUsername || process.env.ARAMEX_USERNAME || process.env.ARAMEX_USER_NAME || '').toString().trim();
        const password = (settings.aramexPassword || process.env.ARAMEX_PASSWORD || '').toString().trim();
        const accountNumber = (settings.aramexAccountNumber || process.env.ARAMEX_ACCOUNT_NUMBER || '').toString().trim();
        const accountPin = (settings.aramexAccountPin || process.env.ARAMEX_ACCOUNT_PIN || '').toString().trim();
        const accountEntity = (settings.aramexAccountEntity || process.env.ARAMEX_ACCOUNT_ENTITY || '').toString().trim();
        const accountCountryCode = (settings.aramexAccountCountryCode || process.env.ARAMEX_ACCOUNT_COUNTRY_CODE || '').toString().trim();
        if (!userName || !password || !accountNumber) {
            return null;
        }
        const shipper = settings.aramexShipper;
        return {
            accountCountryCode: accountCountryCode || 'LB',
            accountEntity: accountEntity || 'BEY',
            accountNumber,
            accountPin: accountPin || '',
            userName,
            password,
            shipper: {
                name: shipper?.name ?? process.env.ARAMEX_SHIPPER_NAME ?? '',
                company: shipper?.company ?? process.env.ARAMEX_SHIPPER_COMPANY ?? '',
                address: shipper?.address ?? process.env.ARAMEX_SHIPPER_ADDRESS ?? '',
                city: shipper?.city ?? process.env.ARAMEX_SHIPPER_CITY ?? process.env.ARAMEX_ACCOUNT_CITY ?? 'Beirut',
                state: shipper?.state ?? process.env.ARAMEX_SHIPPER_STATE ?? '',
                postalcode: shipper?.postalcode ?? process.env.ARAMEX_SHIPPER_POSTALCODE ?? '',
                country: shipper?.country ?? process.env.ARAMEX_SHIPPER_COUNTRY ?? accountCountryCode ?? 'LB',
                phone: shipper?.phone ?? process.env.ARAMEX_SHIPPER_PHONE ?? '',
                email: shipper?.email ?? process.env.ARAMEX_SHIPPER_EMAIL ?? ''
            },
            allowedDomesticMethods: aramex_1.DEFAULT_DOMESTIC_METHODS,
            allowedInternationalMethods: aramex_1.DEFAULT_INTERNATIONAL_METHODS,
            sandbox: process.env.ARAMEX_TEST_MODE !== undefined && process.env.ARAMEX_TEST_MODE !== ''
                ? process.env.ARAMEX_TEST_MODE === 'true'
                : settings.shippingTestMode,
            preferredCurrency: process.env.ARAMEX_CURRENCY || 'USD',
            roundUpPrice: process.env.ARAMEX_ROUND_UP !== 'false',
            reportId: parseInt(process.env.ARAMEX_REPORT_ID || '9729', 10),
            logging: process.env.ARAMEX_LOGGING === 'true'
        };
    }
    cartDataToAramexPackage(cartData) {
        const weight = Math.max(0.5, cartData.totalWeight || 0.5);
        const destination = {
            country: cartData.country,
            city: cartData.city || 'Unknown'
        };
        if (cartData.state !== undefined && cartData.state !== null)
            destination.state = cartData.state;
        if (cartData.postal_code !== undefined && cartData.postal_code !== null)
            destination.postcode = cartData.postal_code;
        return {
            items: [{
                    name: 'Order',
                    quantity: 1,
                    weight,
                    regularPrice: cartData.subtotal,
                    salePrice: cartData.subtotal
                }],
            destination
        };
    }
    getAramexFallbackRate(cost, description) {
        return {
            rate: {
                id: 9999,
                zone_id: 0,
                name: 'Aramex Shipping',
                description,
                method: 'weight_based',
                base_rate: cost,
                per_item_rate: 0,
                per_weight_rate: 0,
                free_shipping_threshold: null,
                min_order_amount: null,
                max_order_amount: null,
                estimated_days: 5,
                is_active: true,
                order_index: 99,
                created_at: new Date(),
                updated_at: new Date()
            },
            cost,
            estimatedDays: 5
        };
    }
    async calculateShippingCost(rateId, cartData) {
        try {
            if (rateId === 9999) {
                try {
                    const settings = await this.getShippingSettings();
                    const clientInfo = (0, aramex_1.getClientInfo)();
                    const shipper = settings.aramexShipper;
                    const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
                    const destCountry = (cartData.country || '').toUpperCase();
                    const isDomestic = shipperCountry === destCountry;
                    const weight = Math.max(0.5, cartData.totalWeight || 0.5);
                    const result = await (0, aramex_1.calculateRateJson)({
                        originAddress: {
                            Line1: (shipper?.address || '').trim() || 'Origin',
                            City: (shipper?.city || process.env.ARAMEX_SHIPPER_CITY || 'Beirut').trim(),
                            StateOrProvinceCode: (shipper?.state || '').trim() || '',
                            PostCode: (shipper?.postalcode || '').replace(/\s/g, '') || '',
                            CountryCode: (shipper?.country || clientInfo.AccountCountryCode || 'LB').trim().toUpperCase()
                        },
                        destinationAddress: {
                            Line1: '',
                            City: (cartData.city || 'Unknown').trim(),
                            StateOrProvinceCode: (cartData.state || '').trim() || '',
                            PostCode: (cartData.postal_code || '').replace(/\s/g, '') || '',
                            CountryCode: destCountry
                        },
                        shipmentDetails: {
                            ActualWeight: { Unit: 'KG', Value: weight },
                            ChargeableWeight: { Unit: 'KG', Value: weight },
                            Dimensions: null,
                            NumberOfPieces: Math.max(1, cartData.items?.length || 1),
                            ProductGroup: isDomestic ? 'DOM' : 'EXP',
                            ProductType: isDomestic ? 'CDS' : 'PPX',
                            PaymentType: 'P',
                            PaymentOptions: '',
                            GoodsOriginCountry: shipperCountry,
                            DescriptionOfGoods: null,
                            CustomsValueAmount: null,
                            CashOnDeliveryAmount: null,
                            Services: ''
                        },
                        preferredCurrencyCode: process.env.ARAMEX_CURRENCY || 'USD'
                    });
                    if (!result.HasErrors && result.TotalAmount != null) {
                        return Math.round(Number(result.TotalAmount.Value));
                    }
                }
                catch {
                }
                return 5.00;
            }
            const [rows] = await database_1.db.query('SELECT * FROM shipping_rates WHERE id = ? AND is_active = TRUE', [rateId]);
            if (rows.length === 0) {
                throw new Error('Shipping rate not found');
            }
            const rate = rows[0];
            if (rate.free_shipping_threshold !== null && cartData.subtotal >= rate.free_shipping_threshold) {
                return 0;
            }
            if (rate.min_order_amount !== null && cartData.subtotal < rate.min_order_amount) {
                throw new Error('Order does not meet minimum amount requirement');
            }
            if (rate.max_order_amount !== null && cartData.subtotal > rate.max_order_amount) {
                throw new Error('Order exceeds maximum amount for this shipping method');
            }
            let cost = rate.base_rate;
            if (rate.method === 'weight_based') {
                cost += cartData.totalWeight * rate.per_weight_rate;
            }
            else if (rate.method === 'price_based') {
                cost += cartData.subtotal * (rate.per_weight_rate / 100);
            }
            cost += cartData.itemCount * rate.per_item_rate;
            return Math.max(0, cost);
        }
        catch (error) {
            console.error('Error calculating shipping cost:', error);
            throw error;
        }
    }
    async getAllShippingZones() {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_zones ORDER BY name ASC');
            return rows;
        }
        catch (error) {
            console.error('Error getting all shipping zones:', error);
            throw error;
        }
    }
    async testAramexShipping(destination, weightKg) {
        const clientInfo = (0, aramex_1.getClientInfo)();
        const settings = await this.getShippingSettings();
        const shipper = settings.aramexShipper;
        const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
        const destCountry = (destination.country || '').toUpperCase();
        const isDomestic = shipperCountry === destCountry;
        const weight = Math.max(0.5, weightKg || 1.5);
        const productGroup = isDomestic ? 'DOM' : 'EXP';
        const productType = isDomestic ? 'CDS' : 'PPX';
        loggerService_1.default.info('ShippingService', `[Aramex] Admin test: destination=${destination.country} ${destination.city || ''}, weightKg=${weight}, productGroup=${productGroup} productType=${productType}`);
        const result = await (0, aramex_1.calculateRateJson)({
            originAddress: {
                Line1: (shipper?.address || '').trim() || 'Origin',
                City: (shipper?.city || process.env.ARAMEX_SHIPPER_CITY || 'Beirut').trim(),
                StateOrProvinceCode: (shipper?.state || '').trim() || '',
                PostCode: (shipper?.postalcode || '').replace(/\s/g, '') || '',
                CountryCode: (shipper?.country || clientInfo.AccountCountryCode || 'LB').trim().toUpperCase()
            },
            destinationAddress: {
                Line1: '',
                City: (destination.city || 'Unknown').trim(),
                StateOrProvinceCode: (destination.state || '').trim() || '',
                PostCode: (destination.postcode || '').replace(/\s/g, '') || '',
                CountryCode: destCountry
            },
            shipmentDetails: {
                ActualWeight: { Unit: 'KG', Value: weight },
                ChargeableWeight: { Unit: 'KG', Value: weight },
                Dimensions: null,
                NumberOfPieces: 1,
                ProductGroup: productGroup,
                ProductType: productType,
                PaymentType: 'P',
                PaymentOptions: '',
                GoodsOriginCountry: shipperCountry,
                DescriptionOfGoods: null,
                CustomsValueAmount: null,
                CashOnDeliveryAmount: null,
                Services: ''
            },
            preferredCurrencyCode: process.env.ARAMEX_CURRENCY || 'USD'
        });
        if (result.HasErrors) {
            const notifs = result.Notifications;
            const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => `${n?.Code}: ${n?.Message}`).join('; ') : 'Aramex error';
            throw new Error('Aramex returned error: ' + msg);
        }
        if (result.TotalAmount == null) {
            throw new Error('Aramex returned no rate for this destination.');
        }
        const cost = Math.round(Number(result.TotalAmount.Value));
        const currency = result.TotalAmount.CurrencyCode || 'USD';
        return {
            success: true,
            rates: [{ id: `${productType}_aramex`, label: `Aramex ${productType}`, cost, currency, method: productType }]
        };
    }
    async getShippingMethodDisplayName(shippingMethod) {
        if (!shippingMethod || typeof shippingMethod !== 'string')
            return 'Standard';
        const match = /^shipping_(\d+)$/.exec(shippingMethod.trim());
        if (!match)
            return shippingMethod;
        const rateId = parseInt(match[1], 10);
        if (rateId === 9999)
            return 'Aramex Shipping';
        const rate = await this.getShippingRateById(rateId);
        return rate?.name ?? shippingMethod;
    }
    async getShippingRateById(rateId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_rates WHERE id = ?', [rateId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting shipping rate by ID:', error);
            throw error;
        }
    }
    async schedulePickupWithExistingShipments(existingShipments, pickupOptions) {
        if (existingShipments.length === 0) {
            return { success: false, error: 'No shipments provided.' };
        }
        const defaults = await this.getAramexPickupDefaults();
        if (!defaults) {
            return { success: false, error: 'Aramex is not configured.' };
        }
        const entity = (process.env.ARAMEX_ACCOUNT_ENTITY || defaults.OriginEntity).trim().toUpperCase();
        const pickupDate = pickupOptions.pickupDate instanceof Date ? pickupOptions.pickupDate : new Date(pickupOptions.pickupDate);
        const readyTime = pickupOptions.readyTime instanceof Date ? pickupOptions.readyTime : new Date(pickupOptions.readyTime);
        const closingTime = pickupOptions.closingTime instanceof Date ? pickupOptions.closingTime : new Date(pickupOptions.closingTime);
        const totalWeight = Math.max(0.5, existingShipments.length * 0.5);
        const body = {
            LabelInfo: null,
            Pickup: {
                PickupAddress: defaults.PickupAddress,
                PickupContact: defaults.PickupContact,
                PickupLocation: (pickupOptions.location || 'Reception').trim(),
                PickupDate: `/Date(${pickupDate.getTime()})/`,
                ReadyTime: `/Date(${readyTime.getTime()})/`,
                LastPickupTime: `/Date(${closingTime.getTime()})/`,
                ClosingTime: `/Date(${closingTime.getTime()})/`,
                Comments: (pickupOptions.comments || `Pickup for ${existingShipments.length} shipment(s)`).trim(),
                Reference1: pickupOptions.reference1 || '',
                Reference2: '',
                Vehicle: (pickupOptions.vehicle || '0').trim(),
                Shipments: [],
                PickupItems: [{
                        ProductGroup: existingShipments[0].productGroup,
                        ProductType: 'CDS',
                        NumberOfShipments: existingShipments.length,
                        PackageType: 'Box',
                        Payment: 'P',
                        ShipmentWeight: { Unit: 'KG', Value: totalWeight },
                        ShipmentVolume: null,
                        NumberOfPieces: existingShipments.length,
                        CashAmount: null,
                        ExtraCharges: null,
                        ShipmentDimensions: { Length: 0.1, Width: 0.1, Height: 0.1, Unit: 'cm' },
                        Comments: pickupOptions.comments || ''
                    }],
                Status: 'Ready',
                ExistingShipments: existingShipments.map((s) => ({
                    Number: String(s.trackingNumber).trim(),
                    OriginEntity: entity,
                    ProductGroup: (s.productGroup || 'DOM').trim()
                })),
                Branch: '',
                RouteCode: ''
            },
            Transaction: { Reference1: '', Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
        };
        try {
            const result = await (0, aramex_1.createPickupJson)(body);
            if (result.HasErrors) {
                const notifs = result.Notifications;
                const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => n?.Message).filter(Boolean).join('; ') : 'CreatePickup failed';
                return { success: false, error: msg };
            }
            const pickupId = result.ProcessedPickup?.ID ?? result.ProcessedPickup?.Reference1 ?? null;
            if (!pickupId)
                return { success: false, error: 'No pickup reference returned.' };
            return { success: true, pickupId, pickupGUID: result.ProcessedPickup?.GUID ?? null };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            loggerService_1.default.error('ShippingService', `Schedule pickup (ExistingShipments) failed: ${message}`);
            return { success: false, error: message };
        }
    }
    async schedulePickupForOrder(order, pickupOptions) {
        const settings = await this.getShippingSettings();
        const config = this.buildAramexConfig(settings);
        if (!config) {
            return {
                success: false,
                error: 'Aramex is not configured. Set username, password, and account in E-commerce Settings.'
            };
        }
        const numberOfPieces = pickupOptions?.numberOfPieces ??
            ((order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0) || 1);
        const weight = pickupOptions?.weight ?? Math.max(0.5, numberOfPieces * 0.5);
        const pickupData = {
            reference1: order.order_number,
            numberOfShipments: pickupOptions?.numberOfShipments ?? 1,
            numberOfPieces,
            weight,
            weightUnit: pickupOptions?.weightUnit ?? 'kg',
            productGroup: pickupOptions?.productGroup ?? 'EXP',
            productType: pickupOptions?.productType ?? 'PPX',
            paymentType: pickupOptions?.paymentType ?? 'P',
            location: pickupOptions?.location ?? 'Reception',
            vehicle: pickupOptions?.vehicle ?? '0',
            comments: pickupOptions?.comments ?? `Order #${order.order_number}`,
            pickupDate: pickupOptions?.pickupDate ?? new Date(),
            readyTime: pickupOptions?.readyTime ??
                (() => {
                    const d = new Date();
                    d.setHours(10, 0, 0, 0);
                    return d;
                })(),
            closingTime: pickupOptions?.closingTime ??
                (() => {
                    const d = new Date();
                    d.setHours(17, 0, 0, 0);
                    return d;
                })()
        };
        try {
            const aramexService = (0, aramex_1.getAramexService)(config);
            const result = await aramexService.createPickup(pickupData);
            if (!result.success || !result.pickupId) {
                return {
                    success: false,
                    error: result?.pickupId ? 'No pickup ID returned' : 'Aramex CreatePickup failed.'
                };
            }
            return { success: true, pickupId: result.pickupId, pickupGUID: result.pickupGUID ?? null };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            loggerService_1.default.error('ShippingService', `Schedule pickup failed: ${message}`);
            return { success: false, error: message };
        }
    }
    getDefaultCityForRate(countryCode) {
        const cityByCountry = {
            LB: 'Beirut',
            AE: 'Dubai',
            SA: 'Riyadh',
            KW: 'Kuwait City',
            QA: 'Doha',
            BH: 'Manama',
            OM: 'Muscat',
            JO: 'Amman',
            EG: 'Cairo',
            IQ: 'Baghdad',
            SY: 'Damascus',
            US: 'New York',
            GB: 'London',
            FR: 'Paris',
            DE: 'Berlin',
            IT: 'Rome',
            ES: 'Madrid',
            CY: 'Nicosia',
            GR: 'Athens',
            TR: 'Istanbul',
            IN: 'Mumbai',
            CN: 'Shanghai',
            AU: 'Sydney',
            CA: 'Toronto'
        };
        return cityByCountry[countryCode.toUpperCase()] || 'Capital';
    }
    normalizeCountryCode(country) {
        if (!country)
            return 'LB';
        const c = (country || '').trim().toUpperCase();
        if (c.length === 2)
            return c;
        const countryMap = {
            'LEBANON': 'LB',
            'UNITED ARAB EMIRATES': 'AE',
            'UAE': 'AE',
            'SAUDI ARABIA': 'SA',
            'KUWAIT': 'KW',
            'QATAR': 'QA',
            'BAHRAIN': 'BH',
            'OMAN': 'OM',
            'JORDAN': 'JO',
            'EGYPT': 'EG',
            'IRAQ': 'IQ',
            'SYRIA': 'SY',
            'UNITED STATES': 'US',
            'UNITED KINGDOM': 'GB',
            'CANADA': 'CA',
            'AUSTRALIA': 'AU',
            'INDIA': 'IN',
            'CHINA': 'CN',
            'FRANCE': 'FR',
            'GERMANY': 'DE',
            'ITALY': 'IT',
            'SPAIN': 'ES'
        };
        if (countryMap[c])
            return countryMap[c];
        loggerService_1.default.warn('ShippingService', `Unknown country name "${country}", using first 2 chars: ${c.substring(0, 2)}`);
        return c.substring(0, 2);
    }
    getCreateShipmentsTestPayload() {
        const emptyParty = () => ({
            Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
            Longitude: 0, Latitude: 0, BuildingNumber: '', BuildingName: '', Floor: '', Apartment: '', POBox: '', Description: ''
        });
        const emptyContact = () => ({
            Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
            PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
        });
        const now = Date.now();
        const due = now + 24 * 60 * 60 * 1000;
        const testShipment = {
            Reference1: 'TEST-' + now,
            Reference2: '',
            Reference3: new Date().toISOString(),
            Shipper: {
                Reference1: 'TEST',
                Reference2: '',
                AccountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '',
                PartyAddress: { ...emptyParty(), Line1: 'Test', City: 'Beirut', CountryCode: 'LB' },
                Contact: { ...emptyContact(), PersonName: 'Test', CompanyName: 'Test', PhoneNumber1: '+9611', CellPhone: '+9611', EmailAddress: 'test@test.com' }
            },
            Consignee: {
                Reference1: '',
                Reference2: '',
                AccountNumber: '',
                PartyAddress: { ...emptyParty(), Line1: 'Consignee Address', City: 'Beirut', CountryCode: 'LB' },
                Contact: { ...emptyContact(), PersonName: 'Test Consignee', CompanyName: 'Test Consignee Company', PhoneNumber1: '+9611234567', CellPhone: '+9611234567', EmailAddress: 'consignee@test.com' }
            },
            ThirdParty: { Reference1: '', Reference2: '', AccountNumber: '', PartyAddress: emptyParty(), Contact: emptyContact() },
            ShippingDateTime: `/Date(${now})/`,
            DueDate: `/Date(${due})/`,
            Comments: 'Test shipment',
            PickupLocation: 'Reception',
            OperationsInstructions: '',
            AccountingInstrcutions: '',
            Details: {
                Dimensions: { Length: 30, Width: 20, Height: 15, Unit: 'cm' },
                ActualWeight: { Unit: 'Kg', Value: 1 },
                ChargeableWeight: { Unit: 'Kg', Value: 1 },
                DescriptionOfGoods: 'Test',
                GoodsOriginCountry: 'LB',
                NumberOfPieces: 1,
                ProductGroup: 'DOM',
                ProductType: 'CDS',
                PaymentType: 'P',
                PaymentOptions: '',
                CustomsValueAmount: { CurrencyCode: 'USD', Value: 10 },
                InsuranceAmount: null,
                CashAdditionalAmount: null,
                CashAdditionalAmountDescription: '',
                CollectAmount: null,
                ContainsDangerousGoods: false,
                CashOnDeliveryAmount: { CurrencyCode: 'USD', Value: 0 },
                Items: []
            },
            Attachments: [],
            ForeignHAWB: 'TEST-' + now,
            TransportType: 0,
            PickupGUID: '',
            Number: '',
            ScheduledDelivery: null
        };
        return {
            LabelInfo: { ReportID: 9729, ReportType: 'URL' },
            Shipments: [testShipment],
            Transaction: { Reference1: 'TEST-' + now, Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
        };
    }
    getCountryDialCode(countryCode) {
        if (!countryCode || typeof countryCode !== 'string')
            return '';
        const code = countryCode.trim().toUpperCase();
        if (!code)
            return '';
        if (ShippingService.countryDialCodeMap === null) {
            try {
                const path = (0, data_paths_1.getDataFilePath)('countries.json');
                const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
                const list = data?.countries || [];
                ShippingService.countryDialCodeMap = {};
                for (const c of list) {
                    const cc = (c?.code || '').toString().trim().toUpperCase();
                    const dial = (c?.InternationalCallingNumber ?? c?.dialCode ?? '').toString().trim();
                    if (cc && dial && dial !== '0')
                        ShippingService.countryDialCodeMap[cc] = dial;
                }
            }
            catch {
                ShippingService.countryDialCodeMap = { LB: '961', US: '1', AE: '971', SA: '966', GB: '44', FR: '33', EG: '20' };
            }
        }
        return ShippingService.countryDialCodeMap[code] || '';
    }
    normalizePhoneForCountry(phone, countryCode) {
        const raw = (phone || '').trim().replace(/\s/g, '');
        const normalized = raw.replace(/^0+/, '');
        if (!normalized)
            return '';
        if (normalized.startsWith('+'))
            return normalized;
        const dial = this.getCountryDialCode(countryCode);
        if (!dial)
            return normalized;
        if (normalized.startsWith(dial))
            return '+' + normalized;
        return '+' + dial + normalized;
    }
    sanitizeShipmentPayload(obj) {
        if (obj === null || obj === undefined)
            return '';
        if (typeof obj === 'number' || typeof obj === 'boolean')
            return obj;
        if (Array.isArray(obj))
            return obj.map((item) => this.sanitizeShipmentPayload(item));
        if (typeof obj === 'object') {
            const out = {};
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                out[k] = v === null || v === undefined ? '' : this.sanitizeShipmentPayload(v);
            }
            return out;
        }
        return typeof obj === 'string' ? obj : String(obj);
    }
    async createShipmentForOrder(order) {
        const settings = await this.getShippingSettings();
        const config = this.buildAramexConfig(settings);
        if (!config) {
            return { success: false, error: 'Aramex is not configured. Set username, password, and account in E-commerce Settings.' };
        }
        const addr = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address || {};
        const rawCountry = addr.country || addr.zip_code || '';
        const countryCode = this.normalizeCountryCode(rawCountry);
        const shipperCountry = (config.shipper.country || 'LB').toString().toUpperCase();
        const isDomesticShipment = shipperCountry !== '' && (countryCode || '').toUpperCase() === shipperCountry;
        const productGroup = isDomesticShipment ? 'DOM' : 'EXP';
        const productType = isDomesticShipment ? 'CDS' : 'PPX';
        const items = order.items || [];
        const totalWeight = Math.max(0.5, items.reduce((s, i) => s + (i.quantity || 1) * 0.5, 0));
        const numberOfPieces = Math.max(1, items.reduce((s, i) => s + (i.quantity || 1), 0));
        const isCod = order.payment_method &&
            (String(order.payment_method).toLowerCase() === 'cash_on_delivery' ||
                String(order.payment_method).toLowerCase().includes('cash'));
        const customsValue = Number(order.total_amount) || 0;
        const currency = String(order.currency || 'USD').trim() || 'USD';
        const reportId = config.reportId || parseInt(process.env.ARAMEX_REPORT_ID || '9729', 10);
        const now = Date.now();
        const dueMs = now + 24 * 60 * 60 * 1000;
        const emptyParty = () => ({
            Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
            Longitude: 0, Latitude: 0, BuildingNumber: '', BuildingName: '', Floor: '', Apartment: '', POBox: '', Description: ''
        });
        const emptyContact = () => ({
            Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
            PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
        });
        const shipperAddress = { ...emptyParty(), Line1: (config.shipper.address || '').trim() || 'Origin', City: (config.shipper.city || 'Beirut').trim(), StateOrProvinceCode: shipperCountry === 'US' ? (config.shipper.state || '').trim() : '', PostCode: (config.shipper.postalcode || '').replace(/\s/g, ''), CountryCode: shipperCountry };
        const shipperName = (config.shipper.name || '').trim() || 'Shipper';
        const shipperPhone = this.normalizePhoneForCountry(config.shipper.phone || '', shipperCountry);
        const shipperContact = { ...emptyContact(), PersonName: shipperName, CompanyName: (config.shipper.company || '').trim() || shipperName, PhoneNumber1: shipperPhone, CellPhone: shipperPhone, EmailAddress: (config.shipper.email || '').trim() };
        const first = (addr.first_name ?? addr.firstName ?? '').toString().trim();
        const last = (addr.last_name ?? addr.lastName ?? '').toString().trim();
        const singleName = (addr.name ?? addr.full_name ?? '').toString().trim();
        const consigneeNameRaw = [first, last].filter(Boolean).join(' ') || singleName || 'Customer' || `Order ${order.order_number}`;
        const consigneeName = consigneeNameRaw.trim() || `Order ${order.order_number}`;
        const consigneeLine1 = (addr.address_line1 || addr.address_line_1 || addr.address || '').toString().trim();
        const consigneeCity = (addr.city || '').toString().trim();
        const consigneeState = (countryCode || '').toString().toUpperCase() === 'US' ? (addr.state || addr.state || '').toString().trim() : '';
        const consigneeAddress = { ...emptyParty(), Line1: consigneeLine1 || 'N/A', Line2: (addr.address_line2 || addr.address_line_2 || '').trim(), City: consigneeCity || 'N/A', StateOrProvinceCode: consigneeState, PostCode: (addr.zip_code || addr.postal_code || addr.postcode || '').toString().replace(/\s/g, ''), CountryCode: countryCode || 'LB' };
        const consigneePhone = this.normalizePhoneForCountry(addr.phone || '', countryCode || 'LB');
        const consigneeCompany = (addr.company_name ?? addr.company ?? '').toString().trim() || consigneeName;
        const consigneeContact = { ...emptyContact(), PersonName: consigneeName, CompanyName: consigneeCompany, PhoneNumber1: consigneePhone, CellPhone: consigneePhone, EmailAddress: (addr.email || '').trim() };
        const details = {
            Dimensions: { Length: 30, Width: 20, Height: 15, Unit: 'cm' },
            ActualWeight: { Unit: 'Kg', Value: Number(totalWeight) || 0.5 },
            ChargeableWeight: { Unit: 'Kg', Value: Number(totalWeight) || 0.5 },
            DescriptionOfGoods: `Order #${String(order.order_number ?? '')}`.substring(0, 65),
            GoodsOriginCountry: String(shipperCountry || 'LB'),
            NumberOfPieces: Math.max(1, Math.floor(Number(numberOfPieces)) || 1),
            ProductGroup: String(productGroup),
            ProductType: String(productType),
            PaymentType: 'P',
            PaymentOptions: '',
            CustomsValueAmount: { CurrencyCode: currency, Value: customsValue },
            InsuranceAmount: null,
            CashAdditionalAmount: null,
            CashAdditionalAmountDescription: '',
            CollectAmount: null,
            ContainsDangerousGoods: false,
            Items: []
        };
        if (isDomesticShipment) {
            const codValue = isCod && (Number(order.total_amount) || 0) > 0 ? Number(order.total_amount) : 0;
            details.CashOnDeliveryAmount = { CurrencyCode: currency, Value: codValue };
            if (isCod && codValue > 0)
                details.Services = 'CODS';
        }
        const ref1 = String(order.order_number ?? '');
        const shipment = {
            Reference1: ref1,
            Reference2: '',
            Reference3: new Date().toISOString(),
            Shipper: { Reference1: ref1, Reference2: '', AccountNumber: String(config.accountNumber ?? ''), PartyAddress: shipperAddress, Contact: shipperContact },
            Consignee: { Reference1: '', Reference2: '', AccountNumber: '', PartyAddress: consigneeAddress, Contact: consigneeContact },
            ThirdParty: { Reference1: '', Reference2: '', AccountNumber: '', PartyAddress: emptyParty(), Contact: emptyContact() },
            ShippingDateTime: `/Date(${now})/`,
            DueDate: `/Date(${dueMs})/`,
            Comments: `Order #${ref1}`,
            PickupLocation: 'Reception',
            OperationsInstructions: '',
            AccountingInstrcutions: '',
            Details: details,
            Attachments: [],
            ForeignHAWB: ref1,
            TransportType: 0,
            PickupGUID: '',
            Number: ''
        };
        shipment.ScheduledDelivery = null;
        const sanitizedShipment = this.sanitizeShipmentPayload(shipment);
        sanitizedShipment.ScheduledDelivery = null;
        const det = sanitizedShipment.Details;
        if (det && typeof det === 'object') {
            det.InsuranceAmount = null;
            det.CashAdditionalAmount = null;
            det.CollectAmount = null;
            det.ContainsDangerousGoods = false;
        }
        const requestBody = {
            LabelInfo: { ReportID: reportId, ReportType: 'URL' },
            Shipments: [sanitizedShipment],
            Transaction: { Reference1: ref1, Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
        };
        const testBody = this.getCreateShipmentsTestPayload();
        const apiUrl = (0, aramex_1.getCreateShipmentsUrl)();
        let requestPayload;
        let testPayload;
        try {
            const clientInfo = (0, aramex_1.getClientInfo)();
            requestPayload = JSON.stringify({ ClientInfo: clientInfo, ...requestBody }, null, 2);
            testPayload = JSON.stringify({ ClientInfo: clientInfo, ...testBody }, null, 2);
        }
        catch {
            requestPayload = JSON.stringify(requestBody, null, 2);
            testPayload = JSON.stringify(testBody, null, 2);
        }
        try {
            (0, aramex_1.getClientInfo)();
            loggerService_1.default.info('ShippingService', `Creating shipment (JSON API) for order ${ref1}, weight: ${totalWeight}, ${productGroup}/${productType}`);
            loggerService_1.default.info('CreateShipmentRequest', { orderNumber: ref1, payload: requestBody });
            const rawResponse = await (0, aramex_1.createShipmentsJson)(requestBody);
            const parsed = (0, aramex_1.parseCreateShipmentsResponse)(rawResponse);
            if (parsed.hasErrors || !parsed.trackingId) {
                const detail = parsed.errorMessages?.length
                    ? parsed.errorMessages.join('; ')
                    : parsed.hasErrors
                        ? 'Aramex CreateShipments returned errors (no messages in response).'
                        : 'Aramex CreateShipments did not return a tracking number.';
                loggerService_1.default.error('ShippingService', `Create shipment failed for order ${order.order_number}: ${detail}. Raw response (first 500 chars): ${parsed.rawResponse.substring(0, 500)}`);
                loggerService_1.default.error('CreateShipmentError', { orderNumber: ref1, requestPayload: requestBody, response: parsed.rawResponse, errorMessages: parsed.errorMessages });
                const isAramexServerError = /ERR00|NullReferenceException|Internal server error has occured/i.test(detail);
                const userMessage = isAramexServerError
                    ? 'Aramex is temporarily reporting an internal error. Please try again in a few minutes. If it persists, contact Aramex support.'
                    : detail;
                return {
                    success: false,
                    error: userMessage,
                    debug: { errorMessages: parsed.errorMessages, rawResponse: parsed.rawResponse, aramexDetail: detail },
                    requestPayload,
                    testPayload,
                    apiUrl
                };
            }
            return {
                success: true,
                shipmentId: parsed.trackingId,
                labelUrl: parsed.labelUrl,
                productGroup,
                productType,
                rawResponse: parsed.rawResponse,
                requestPayload,
                testPayload,
                apiUrl
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : '';
            loggerService_1.default.error('ShippingService', `Create shipment failed for order ${order.order_number}: ${message}${stack ? '. ' + stack : ''}`);
            loggerService_1.default.error('CreateShipmentException', { orderNumber: ref1, requestPayload: requestBody, error: message });
            return { success: false, error: message, debug: { message, stack }, requestPayload, testPayload, apiUrl };
        }
    }
    async getAramexPickupDefaults() {
        const settings = await this.getShippingSettings();
        const config = this.buildAramexConfig(settings);
        if (!config)
            return null;
        const shipper = config.shipper;
        const emptyAddr = () => ({
            Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
            Longitude: 0, Latitude: 0, BuildingNumber: null, BuildingName: null, Floor: null, Apartment: null, POBox: null, Description: null
        });
        const emptyContact = () => ({
            Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
            PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
        });
        const countryCode = (shipper?.country || config.accountCountryCode || 'LB').toString().toUpperCase();
        return {
            PickupAddress: { ...emptyAddr(), Line1: (shipper?.address || '').trim() || 'Origin', City: (shipper?.city || 'Beirut').trim(), StateOrProvinceCode: (shipper?.state || '').trim(), PostCode: (shipper?.postalcode || '').replace(/\s/g, ''), CountryCode: countryCode },
            PickupContact: { ...emptyContact(), PersonName: (shipper?.name || '').trim(), CompanyName: (shipper?.company || '').trim(), PhoneNumber1: (shipper?.phone || '').trim(), CellPhone: (shipper?.phone || '').trim(), EmailAddress: (shipper?.email || '').trim() },
            OriginEntity: (config.accountEntity || process.env.ARAMEX_ACCOUNT_ENTITY || 'BEY').trim().toUpperCase()
        };
    }
    async getWaybillLabelForOrder(order) {
        if (!order.tracking_number || !order.tracking_number.trim()) {
            return { success: false, error: 'No tracking number. Generate waybill first.' };
        }
        const settings = await this.getShippingSettings();
        const config = this.buildAramexConfig(settings);
        if (!config) {
            return { success: false, error: 'Aramex is not configured.' };
        }
        try {
            const aramexService = (0, aramex_1.getAramexService)(config);
            const result = await aramexService.printLabel(order.tracking_number.trim(), order.order_number, null);
            if (!result.success || !result.labelUrl) {
                return { success: false, error: 'Could not get label URL from Aramex.' };
            }
            return { success: true, labelUrl: result.labelUrl };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            loggerService_1.default.error('ShippingService', `Print waybill failed: ${message}`);
            return { success: false, error: message };
        }
    }
}
exports.ShippingService = ShippingService;
ShippingService.countryDialCodeMap = null;
exports.default = ShippingService.getInstance();
//# sourceMappingURL=shippingService.js.map