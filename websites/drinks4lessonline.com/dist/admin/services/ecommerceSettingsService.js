"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcommerceSettingsService = void 0;
const database_1 = require("../../src/config/database");
class EcommerceSettingsService {
    constructor() { }
    static getInstance() {
        if (!EcommerceSettingsService.instance) {
            EcommerceSettingsService.instance = new EcommerceSettingsService();
        }
        return EcommerceSettingsService.instance;
    }
    async getSettings() {
        try {
            const [rows] = await database_1.db.query(`SELECT setting_key, setting_value FROM site_settings 
         WHERE setting_key LIKE 'ecommerce_%'`);
            const settings = {};
            rows.forEach((row) => {
                const key = row.setting_key.replace('ecommerce_', '');
                let value = row.setting_value;
                if (value && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    }
                    catch (e) {
                    }
                }
                if (value === 'true')
                    value = true;
                if (value === 'false')
                    value = false;
                if (value === 'null')
                    value = null;
                if (value === 'undefined')
                    return;
                if (key === 'tax_rate' && value !== null) {
                    value = parseFloat(value);
                }
                if (key === 'default_shipping_zone' && value !== null && value !== '') {
                    value = parseInt(value);
                }
                if (key === 'shipping_methods' && typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    }
                    catch (e) {
                        value = [];
                    }
                }
                if (key === 'aramex_shipper' && typeof value === 'string') {
                    try {
                        value = value && value !== 'null' ? JSON.parse(value) : undefined;
                    }
                    catch (e) {
                        value = undefined;
                    }
                }
                settings[key] = value;
            });
            return settings;
        }
        catch (error) {
            console.error('Error getting e-commerce settings:', error);
            return {};
        }
    }
    async updateSettings(settings) {
        try {
            for (const [key, value] of Object.entries(settings)) {
                if (value === undefined)
                    continue;
                const settingKey = `ecommerce_${key}`;
                let settingValue;
                if (value === null) {
                    settingValue = 'null';
                }
                else if (typeof value === 'object') {
                    settingValue = JSON.stringify(value);
                }
                else {
                    settingValue = String(value);
                }
                await database_1.db.query(`INSERT INTO site_settings (setting_key, setting_value, updated_at) 
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [settingKey, settingValue, settingValue]);
            }
        }
        catch (error) {
            console.error('Error updating e-commerce settings:', error);
            throw error;
        }
    }
    async getAllShippingZones() {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_zones ORDER BY name ASC');
            return rows;
        }
        catch (error) {
            console.error('Error getting shipping zones:', error);
            throw error;
        }
    }
    async getShippingZoneById(id) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_zones WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting shipping zone:', error);
            throw error;
        }
    }
    async createShippingZone(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO shipping_zones (name, description, countries, is_active) 
         VALUES (?, ?, ?, ?)`, [
                data.name,
                data.description || null,
                JSON.stringify(data.countries),
                data.is_active !== undefined ? data.is_active : true
            ]);
            const zone = await this.getShippingZoneById(result.insertId);
            if (!zone) {
                throw new Error('Failed to retrieve created shipping zone');
            }
            return zone;
        }
        catch (error) {
            console.error('Error creating shipping zone:', error);
            throw error;
        }
    }
    async updateShippingZone(id, data) {
        try {
            const updates = [];
            const values = [];
            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                values.push(data.description);
            }
            if (data.countries !== undefined) {
                updates.push('countries = ?');
                values.push(JSON.stringify(data.countries));
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE shipping_zones SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
            const zone = await this.getShippingZoneById(id);
            if (!zone) {
                throw new Error('Shipping zone not found');
            }
            return zone;
        }
        catch (error) {
            console.error('Error updating shipping zone:', error);
            throw error;
        }
    }
    async deleteShippingZone(id) {
        try {
            await database_1.db.query('DELETE FROM shipping_zones WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting shipping zone:', error);
            throw error;
        }
    }
    async getShippingRatesForZone(zoneId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM shipping_rates WHERE zone_id = ? ORDER BY order_index ASC, id ASC', [zoneId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting shipping rates:', error);
            throw error;
        }
    }
    async createShippingRate(data) {
        try {
            const [result] = await database_1.db.query(`INSERT INTO shipping_rates (
          zone_id, name, description, method, base_rate, per_item_rate, 
          per_weight_rate, free_shipping_threshold, min_order_amount, 
          max_order_amount, estimated_days, is_active, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                data.zone_id,
                data.name,
                data.description || null,
                data.method,
                data.base_rate,
                data.per_item_rate || 0,
                data.per_weight_rate || 0,
                data.free_shipping_threshold || null,
                data.min_order_amount || null,
                data.max_order_amount || null,
                data.estimated_days || null,
                data.is_active !== undefined ? data.is_active : true,
                data.order_index || 0
            ]);
            const [rows] = await database_1.db.query('SELECT * FROM shipping_rates WHERE id = ?', [result.insertId]);
            return rows[0];
        }
        catch (error) {
            console.error('Error creating shipping rate:', error);
            throw error;
        }
    }
    async updateShippingRate(id, data) {
        try {
            const updates = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            });
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE shipping_rates SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
            const [rows] = await database_1.db.query('SELECT * FROM shipping_rates WHERE id = ?', [id]);
            return rows[0];
        }
        catch (error) {
            console.error('Error updating shipping rate:', error);
            throw error;
        }
    }
    async deleteShippingRate(id) {
        try {
            await database_1.db.query('DELETE FROM shipping_rates WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting shipping rate:', error);
            throw error;
        }
    }
    async getPaymentMethods() {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM payment_methods ORDER BY order_index ASC, id ASC');
            return rows.map((row) => ({
                ...row,
                config: row.config ? JSON.parse(row.config) : {}
            }));
        }
        catch (error) {
            console.error('Error getting payment methods:', error);
            throw error;
        }
    }
    async updatePaymentMethod(id, data) {
        try {
            const updates = [];
            const values = [];
            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                values.push(data.description);
            }
            if (data.config !== undefined) {
                updates.push('config = ?');
                values.push(JSON.stringify(data.config));
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }
            if (updates.length > 0) {
                values.push(id);
                await database_1.db.query(`UPDATE payment_methods SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
            }
        }
        catch (error) {
            console.error('Error updating payment method:', error);
            throw error;
        }
    }
}
exports.EcommerceSettingsService = EcommerceSettingsService;
//# sourceMappingURL=ecommerceSettingsService.js.map