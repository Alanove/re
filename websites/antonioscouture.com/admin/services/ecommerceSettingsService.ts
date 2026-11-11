import { db } from '../../src/config/database';
import { ShippingZone, ShippingRate } from '../../src/services/shippingService';
import * as mysql from 'mysql2/promise';

export interface AramexShipperSettings {
  name?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  postalcode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface EcommerceSettings {
  store_name?: string;
  store_email?: string;
  store_phone?: string;
  store_address?: string;
  currency?: string;
  currency_symbol?: string;
  tax_enabled?: boolean;
  tax_rate?: number;
  default_shipping_zone?: number | null;
  shipping_zones_enabled?: boolean;
  shipping_methods?: string[];
  /** Global: when true, all shipping providers (e.g. Aramex) use sandbox/test mode */
  shipping_test_mode?: boolean;
  /** Aramex shipper (origin) details for rate calculation and shipment creation */
  aramex_shipper?: AramexShipperSettings;
  /** Optional overrides from admin; env used when blank */
  aramex_account_entity?: string;
  aramex_account_country_code?: string;
  aramex_account_number?: string;
  /** Optional; when blank, use env ARAMEX_ACCOUNT_PIN. Do not overwrite with empty. */
  aramex_account_pin?: string;
  aramex_username?: string;
  aramex_password?: string;
  /**
   * When a product has multiple variant prices, how to show price on the storefront (home, shop, product page before a variant is focused).
   * Cart and checkout always use the selected line item price.
   */
  multi_price_display?: 'lowest' | 'starting' | 'range';
  facebook_app_id?: string;
  /** Raw HTML/JS snippet for Meta Pixel (injected unescaped in storefront layout head). */
  facebook_pixel_script?: string;
}

export class EcommerceSettingsService {
  private static instance: EcommerceSettingsService;

  private constructor() { }

  public static getInstance(): EcommerceSettingsService {
    if (!EcommerceSettingsService.instance) {
      EcommerceSettingsService.instance = new EcommerceSettingsService();
    }
    return EcommerceSettingsService.instance;
  }

  /**
   * Get e-commerce settings from site_settings
   */
  public async getSettings(): Promise<EcommerceSettings> {
    try {
      const [rows] = await db.query<any>(
        `SELECT setting_key, setting_value FROM site_settings 
         WHERE setting_key LIKE 'ecommerce_%'`
      );

      const settings: EcommerceSettings = {};
      rows.forEach((row: any) => {
        const key = row.setting_key.replace('ecommerce_', '');
        let value: any = row.setting_value;

        // Parse JSON values
        if (value && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        // Convert boolean strings
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        if (value === 'null') value = null;
        if (value === 'undefined') return; // Skip undefined values

        // Convert numbers
        if (key === 'tax_rate' && value !== null) {
          value = parseFloat(value);
        }
        if (key === 'default_shipping_zone' && value !== null && value !== '') {
          value = parseInt(value);
        }

        // Ensure shipping_methods is array
        if (key === 'shipping_methods' && typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = [];
          }
        }

        // Ensure aramex_shipper is object
        if (key === 'aramex_shipper' && typeof value === 'string') {
          try {
            value = value && value !== 'null' ? JSON.parse(value) : undefined;
          } catch (e) {
            value = undefined;
          }
        }

        (settings as any)[key] = value;
      });

      return settings;
    } catch (error) {
      console.error('Error getting e-commerce settings:', error);
      return {};
    }
  }

  /**
   * Update e-commerce settings
   */
  public async updateSettings(settings: Partial<EcommerceSettings>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (value === undefined) continue;

        const settingKey = `ecommerce_${key}`;
        let settingValue: string;

        if (value === null) {
          settingValue = 'null';
        } else if (typeof value === 'object') {
          settingValue = JSON.stringify(value);
        } else {
          settingValue = String(value);
        }

        await db.query(
          `INSERT INTO site_settings (setting_key, setting_value, updated_at) 
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
          [settingKey, settingValue, settingValue]
        );
      }
    } catch (error) {
      console.error('Error updating e-commerce settings:', error);
      throw error;
    }
  }

  /**
   * Get all shipping zones
   */
  public async getAllShippingZones(): Promise<ShippingZone[]> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM shipping_zones ORDER BY name ASC'
      );
      return (rows as unknown) as ShippingZone[];
    } catch (error) {
      console.error('Error getting shipping zones:', error);
      throw error;
    }
  }

  /**
   * Get shipping zone by ID
   */
  public async getShippingZoneById(id: number): Promise<ShippingZone | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM shipping_zones WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? ((rows[0] as unknown) as ShippingZone) : null;
    } catch (error) {
      console.error('Error getting shipping zone:', error);
      throw error;
    }
  }

  /**
   * Create shipping zone
   */
  public async createShippingZone(data: {
    name: string;
    description?: string;
    countries: string[];
    is_active?: boolean;
  }): Promise<ShippingZone> {
    try {
      const [result] = await db.query(
        `INSERT INTO shipping_zones (name, description, countries, is_active) 
         VALUES (?, ?, ?, ?)`,
        [
          data.name,
          data.description || null,
          JSON.stringify(data.countries),
          data.is_active !== undefined ? data.is_active : true
        ]
      );

      const zone = await this.getShippingZoneById((result as unknown as mysql.ResultSetHeader).insertId);
      if (!zone) {
        throw new Error('Failed to retrieve created shipping zone');
      }
      return zone;
    } catch (error) {
      console.error('Error creating shipping zone:', error);
      throw error;
    }
  }

  /**
   * Update shipping zone
   */
  public async updateShippingZone(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      countries: string[];
      is_active: boolean;
    }>
  ): Promise<ShippingZone> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

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
        await db.query(
          `UPDATE shipping_zones SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      const zone = await this.getShippingZoneById(id);
      if (!zone) {
        throw new Error('Shipping zone not found');
      }
      return zone;
    } catch (error) {
      console.error('Error updating shipping zone:', error);
      throw error;
    }
  }

  /**
   * Delete shipping zone
   */
  public async deleteShippingZone(id: number): Promise<void> {
    try {
      await db.query('DELETE FROM shipping_zones WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting shipping zone:', error);
      throw error;
    }
  }

  /**
   * Get shipping rates for zone
   */
  public async getShippingRatesForZone(zoneId: number): Promise<ShippingRate[]> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM shipping_rates WHERE zone_id = ? ORDER BY order_index ASC, id ASC',
        [zoneId]
      );
      return (rows as unknown) as ShippingRate[];
    } catch (error) {
      console.error('Error getting shipping rates:', error);
      throw error;
    }
  }

  /**
   * Create shipping rate
   */
  public async createShippingRate(data: {
    zone_id: number;
    name: string;
    description?: string;
    method: 'flat_rate' | 'weight_based' | 'price_based';
    base_rate: number;
    per_item_rate?: number;
    per_weight_rate?: number;
    free_shipping_threshold?: number | null;
    min_order_amount?: number | null;
    max_order_amount?: number | null;
    estimated_days?: number | null;
    is_active?: boolean;
    order_index?: number;
  }): Promise<ShippingRate> {
    try {
      const [result] = await db.query<any>(
        `INSERT INTO shipping_rates (
          zone_id, name, description, method, base_rate, per_item_rate, 
          per_weight_rate, free_shipping_threshold, min_order_amount, 
          max_order_amount, estimated_days, is_active, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );

      const [rows] = await db.query<any>(
        'SELECT * FROM shipping_rates WHERE id = ?',
        [(result as unknown as mysql.ResultSetHeader).insertId]
      );
      return (rows as any)[0];
    } catch (error) {
      console.error('Error creating shipping rate:', error);
      throw error;
    }
  }

  /**
   * Update shipping rate
   */
  public async updateShippingRate(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      method: 'flat_rate' | 'weight_based' | 'price_based';
      base_rate: number;
      per_item_rate: number;
      per_weight_rate: number;
      free_shipping_threshold: number | null;
      min_order_amount: number | null;
      max_order_amount: number | null;
      estimated_days: number | null;
      is_active: boolean;
      order_index: number;
    }>
  ): Promise<ShippingRate> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (updates.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE shipping_rates SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      const [rows] = await db.query<any>(
        'SELECT * FROM shipping_rates WHERE id = ?',
        [id]
      );
      return ((rows[0] as unknown) as ShippingRate);
    } catch (error) {
      console.error('Error updating shipping rate:', error);
      throw error;
    }
  }

  /**
   * Delete shipping rate
   */
  public async deleteShippingRate(id: number): Promise<void> {
    try {
      await db.query('DELETE FROM shipping_rates WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting shipping rate:', error);
      throw error;
    }
  }

  /**
   * Get payment methods
   */
  public async getPaymentMethods(): Promise<any[]> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM payment_methods ORDER BY order_index ASC, id ASC'
      );
      return rows.map((row: any) => ({
        ...row,
        config: row.config ? JSON.parse(row.config) : {}
      }));
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw error;
    }
  }

  /**
   * Update payment method
   */
  public async updatePaymentMethod(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      config: any;
      is_active: boolean;
    }>
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

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
        await db.query(
          `UPDATE payment_methods SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  }
}

