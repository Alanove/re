import * as fs from 'fs';
import { db } from '../config/database';
import { getDataFilePath } from '../constants/data-paths';
import logger from './loggerService';
import {
  getAramexService,
  calculateRateJson,
  getClientInfo,
  createShipmentsJson,
  getCreateShipmentsUrl,
  parseCreateShipmentsResponse,
  createPickupJson,
  DEFAULT_DOMESTIC_METHODS,
  DEFAULT_INTERNATIONAL_METHODS,
  type AramexConfig,
  type AramexPackageData,
  type AramexCreatePickupData
} from '../aramex';

export interface ShippingZone {
  id: number;
  name: string;
  description: string | null;
  countries: string; // JSON array
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShippingRate {
  id: number;
  zone_id: number;
  name: string;
  description: string | null;
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
  created_at: Date;
  updated_at: Date;
}

export interface ShippingCalculation {
  rate: ShippingRate;
  cost: number;
  estimatedDays: number | null;
}

export interface CartShippingData {
  subtotal: number;
  totalPrice: number;
  itemCount: number;
  totalWeight: number;
  country: string; // ISO 2-letter code
  city?: string;
  address?: string;
  state?: string;
  postal_code?: string;
  items: any[];
}

export interface ShippingSettingsResult {
  zonesEnabled: boolean;
  methods: string[];
  shippingTestMode: boolean;
  /** When set, used for any country that does not match a zone's countries list */
  defaultShippingZoneId?: number | null;
  aramexShipper?: { name?: string; company?: string; address?: string; city?: string; state?: string; postalcode?: string; country?: string; phone?: string; email?: string };
  aramexAccountEntity?: string;
  aramexAccountCountryCode?: string;
  aramexAccountNumber?: string;
  aramexAccountPin?: string;
  aramexUsername?: string;
  aramexPassword?: string;
}

export class ShippingService {
  private static instance: ShippingService;

  private constructor() { }

  public static getInstance(): ShippingService {
    if (!ShippingService.instance) {
      ShippingService.instance = new ShippingService();
    }
    return ShippingService.instance;
  }

  /**
   * Get shipping zone for country
   */
  public async getShippingZoneForCountry(country: string): Promise<ShippingZone | null> {
    try {
      const normalized = (country || '').trim().toUpperCase();
      if (!normalized) return null;

      const [rows] = await db.query<ShippingZone>(
        'SELECT * FROM shipping_zones WHERE is_active = TRUE'
      );

      for (const zone of rows) {
        const countries = JSON.parse(zone.countries || '[]');
        const match = Array.isArray(countries) && countries.some(
          (c: string) => String(c).trim().toUpperCase() === normalized
        );
        if (match) return zone;
      }

      return null;
    } catch (error) {
      console.error('Error getting shipping zone for country:', error);
      return null;
    }
  }

  /**
   * Get shipping zone by ID (for default zone fallback).
   */
  public async getShippingZoneById(zoneId: number): Promise<ShippingZone | null> {
    try {
      const [rows] = await db.query<ShippingZone>(
        'SELECT * FROM shipping_zones WHERE id = ? AND is_active = TRUE',
        [zoneId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting shipping zone by id:', error);
      return null;
    }
  }

  /**
   * Get shipping rates for zone
   */
  public async getShippingRatesForZone(zoneId: number): Promise<ShippingRate[]> {
    try {
      const [rows] = await db.query<ShippingRate>(
        `SELECT * FROM shipping_rates 
        WHERE zone_id = ? AND is_active = TRUE 
        ORDER BY order_index ASC, id ASC`,
        [zoneId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting shipping rates for zone:', error);
      throw error;
    }
  }

  /**
   * Get available shipping rates for cart
   */
  public async getAvailableShippingRates(
    cartData: CartShippingData
  ): Promise<ShippingCalculation[]> {
    try {
      const calculations: ShippingCalculation[] = [];
      const settings = await this.getShippingSettings();

      // Normalize country to ISO 2-letter code so zone lookup and Aramex get a consistent value
      // (checkout sends code e.g. "FR", but saved addresses or APIs might send "France")
      const countryCode = this.normalizeCountryCode(cartData.country);

      // 1. Database (Custom) Rates – only when zones are enabled
      if (settings.zonesEnabled && settings.methods.includes('custom')) {
        let zone = await this.getShippingZoneForCountry(countryCode);
        // If no zone matches this country, use the default shipping zone (e.g. "International") so all countries get rates
        if (!zone && settings.defaultShippingZoneId) {
          zone = await this.getShippingZoneById(settings.defaultShippingZoneId);
        }
        if (zone) {
          const rates = await this.getShippingRatesForZone(zone.id);

          for (const rate of rates) {
            if (!rate.is_active) continue;

            // Check order amount restrictions
            if (rate.min_order_amount !== null && cartData.subtotal < rate.min_order_amount) {
              continue;
            }

            if (rate.max_order_amount !== null && cartData.subtotal > rate.max_order_amount) {
              continue;
            }

            // Check free shipping threshold
            if (rate.free_shipping_threshold !== null && cartData.subtotal >= rate.free_shipping_threshold) {
              calculations.push({
                rate,
                cost: 0,
                estimatedDays: rate.estimated_days
              });
              continue;
            }

            // Calculate shipping cost based on method
            let cost = rate.base_rate;

            if (rate.method === 'weight_based') {
              cost += cartData.totalWeight * rate.per_weight_rate;
            } else if (rate.method === 'price_based') {
              cost += cartData.subtotal * (rate.per_weight_rate / 100);
            }

            cost += cartData.itemCount * rate.per_item_rate;

            calculations.push({
              rate,
              cost: Math.max(0, cost),
              estimatedDays: rate.estimated_days
            });
          }
        }
      }

      // 2. Aramex Rates (new JSON API) – ClientInfo from .env only; origin from shipper settings
      if (countryCode) {
        try {
          const destCity = (cartData.city || '').trim();
          const destinationCity = destCity || this.getDefaultCityForRate(countryCode);
          if (process.env.NODE_ENV === 'development') {
            process.stdout.write(`[Aramex] Fetching rates for ${countryCode} / ${destinationCity} ...\n`);
          }
          const clientInfo = getClientInfo();
          const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
          const destCountry = countryCode;
          const isDomestic = shipperCountry === destCountry;
          const shipper = settings.aramexShipper;
          const originCity = (shipper?.city || process.env.ARAMEX_SHIPPER_CITY || 'Beirut').trim();
          const originCountry = (shipper?.country || clientInfo.AccountCountryCode || 'LB').trim().toUpperCase();
          const weight = Math.max(0.5, cartData.totalWeight || 0.5);
          const productGroup = isDomestic ? 'DOM' : 'EXP';
          const productType = isDomestic ? 'CDS' : 'PPX';
          const result = await calculateRateJson({
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
          } else {
            const notifs = result.Notifications?.Notification;
            const list = notifs == null ? [] : Array.isArray(notifs) ? notifs : [notifs];
            const messages = list.map((n: { Code?: string; Message?: string }) => `${n?.Code || ''}: ${n?.Message || ''}`.trim()).filter(Boolean);
            const msg = result.HasErrors
              ? `Aramex CalculateRate errors for ${destCountry}/${destinationCity}: ${messages.length ? messages.join('; ') : JSON.stringify(result.Notifications)}`
              : `Aramex CalculateRate no rate for ${destCountry}/${destinationCity} (TotalAmount missing or HasErrors): ${JSON.stringify(result)}`;
            logger.error('ShippingService', msg);
            console.error('[Aramex shipping]', msg);
          }
        } catch (error) {
          const msg = `Failed to fetch Aramex rates: ${error instanceof Error ? error.message : String(error)}`;
          logger.error('ShippingService', msg);
          console.error('[Aramex shipping]', msg);
        }
      }

      return calculations.sort((a, b) => a.cost - b.cost);
    } catch (error) {
      console.error('Error getting available shipping rates:', error);
      throw error;
    }
  }

  private async getShippingSettings(): Promise<ShippingSettingsResult> {
    try {
      const [rows] = await db.query<any>(
        `SELECT setting_key, setting_value FROM site_settings 
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
         )`
      );

      let zonesEnabled = true;
      let methods: string[] = ['custom'];
      let shippingTestMode = false;
      let defaultShippingZoneId: number | null = null;
      let aramexShipper: { name?: string; company?: string; address?: string; city?: string; state?: string; postalcode?: string; country?: string; phone?: string; email?: string } | undefined;
      let aramexAccountEntity: string | undefined;
      let aramexAccountCountryCode: string | undefined;
      let aramexAccountNumber: string | undefined;
      let aramexAccountPin: string | undefined;
      let aramexUsername: string | undefined;
      let aramexPassword: string | undefined;

      rows.forEach((row: any) => {
        if (row.setting_key === 'ecommerce_shipping_zones_enabled') {
          zonesEnabled = row.setting_value === 'true';
        }
        if (row.setting_key === 'ecommerce_shipping_methods') {
          try {
            methods = JSON.parse(row.setting_value);
            if (!Array.isArray(methods)) methods = [];
          } catch (e) {
            methods = [];
          }
        }
        if (row.setting_key === 'ecommerce_shipping_test_mode') {
          shippingTestMode = row.setting_value === 'true';
        }
        if (row.setting_key === 'ecommerce_default_shipping_zone' && row.setting_value && row.setting_value !== 'null') {
          const v = parseInt(row.setting_value, 10);
          if (!isNaN(v)) defaultShippingZoneId = v;
        }
        if (row.setting_key === 'ecommerce_aramex_shipper' && row.setting_value && row.setting_value !== 'null') {
          try {
            aramexShipper = JSON.parse(row.setting_value);
          } catch (e) {
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

      const result: ShippingSettingsResult = {
        zonesEnabled,
        methods,
        shippingTestMode
      };
      if (defaultShippingZoneId !== null) result.defaultShippingZoneId = defaultShippingZoneId;
      if (aramexShipper !== undefined) result.aramexShipper = aramexShipper;
      if (aramexAccountEntity !== undefined) result.aramexAccountEntity = aramexAccountEntity;
      if (aramexAccountCountryCode !== undefined) result.aramexAccountCountryCode = aramexAccountCountryCode;
      if (aramexAccountNumber !== undefined) result.aramexAccountNumber = aramexAccountNumber;
      if (aramexAccountPin !== undefined) result.aramexAccountPin = aramexAccountPin;
      if (aramexUsername !== undefined) result.aramexUsername = aramexUsername;
      if (aramexPassword !== undefined) result.aramexPassword = aramexPassword;
      return result;
    } catch (error) {
      console.error('Error fetching shipping settings:', error);
      return { zonesEnabled: true, methods: ['custom'], shippingTestMode: false };
    }
  }

  /**
   * Build Aramex config for API calls. Must match lib/aramex/test-calculate-shipping.js for same behaviour:
   * - userName, password, accountNumber, accountPin, accountEntity, accountCountryCode (test: LB, BEY, 72478367, 316198, etc.)
   * - sandbox: test uses false (production). We use ARAMEX_TEST_MODE from env when set, else admin "Use shipping test mode".
   *   ERR75 (Failed to login) often means sandbox mismatch: production credentials sent to ws.dev.aramex.net or vice versa.
   */
  private buildAramexConfig(settings: ShippingSettingsResult): AramexConfig | null {
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
      allowedDomesticMethods: DEFAULT_DOMESTIC_METHODS,
      allowedInternationalMethods: DEFAULT_INTERNATIONAL_METHODS,
      // Match working test: use ARAMEX_TEST_MODE from env when set (e.g. false = production). Admin "Use shipping test mode" used only when env not set.
      sandbox: process.env.ARAMEX_TEST_MODE !== undefined && process.env.ARAMEX_TEST_MODE !== ''
        ? process.env.ARAMEX_TEST_MODE === 'true'
        : settings.shippingTestMode,
      preferredCurrency: process.env.ARAMEX_CURRENCY || 'USD',
      roundUpPrice: process.env.ARAMEX_ROUND_UP !== 'false',
      reportId: parseInt(process.env.ARAMEX_REPORT_ID || '9729', 10),
      logging: process.env.ARAMEX_LOGGING === 'true'
    };
  }

  private cartDataToAramexPackage(cartData: CartShippingData): AramexPackageData {
    const weight = Math.max(0.5, cartData.totalWeight || 0.5);
    const destination: AramexPackageData['destination'] = {
      country: cartData.country,
      city: cartData.city || 'Unknown'
    };
    if (cartData.state !== undefined && cartData.state !== null) destination.state = cartData.state;
    if (cartData.postal_code !== undefined && cartData.postal_code !== null) destination.postcode = cartData.postal_code;
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

  private getAramexFallbackRate(cost: number, description: string): ShippingCalculation {
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

  /**
   * Calculate shipping cost for specific rate
   */
  public async calculateShippingCost(
    rateId: number,
    cartData: CartShippingData
  ): Promise<number> {
    try {
      // Handle Aramex pseudo-ID (new JSON API)
      if (rateId === 9999) {
        try {
          const settings = await this.getShippingSettings();
          const clientInfo = getClientInfo();
          const shipper = settings.aramexShipper;
          const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
          const destCountry = (cartData.country || '').toUpperCase();
          const isDomestic = shipperCountry === destCountry;
          const weight = Math.max(0.5, cartData.totalWeight || 0.5);
          const result = await calculateRateJson({
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
        } catch {
          // Missing Aramex .env or API error
        }
        return 5.00;
      }

      const [rows] = await db.query<ShippingRate>(
        'SELECT * FROM shipping_rates WHERE id = ? AND is_active = TRUE',
        [rateId]
      );

      if (rows.length === 0) {
        throw new Error('Shipping rate not found');
      }

      const rate = rows[0];

      // Check free shipping threshold
      if (rate.free_shipping_threshold !== null && cartData.subtotal >= rate.free_shipping_threshold) {
        return 0;
      }

      // Check order amount restrictions
      if (rate.min_order_amount !== null && cartData.subtotal < rate.min_order_amount) {
        throw new Error('Order does not meet minimum amount requirement');
      }

      if (rate.max_order_amount !== null && cartData.subtotal > rate.max_order_amount) {
        throw new Error('Order exceeds maximum amount for this shipping method');
      }

      // Calculate cost
      let cost = rate.base_rate;

      if (rate.method === 'weight_based') {
        cost += cartData.totalWeight * rate.per_weight_rate;
      } else if (rate.method === 'price_based') {
        cost += cartData.subtotal * (rate.per_weight_rate / 100);
      }

      cost += cartData.itemCount * rate.per_item_rate;

      return Math.max(0, cost);
    } catch (error) {
      console.error('Error calculating shipping cost:', error);
      throw error;
    }
  }

  /**
   * Get all shipping zones
   */
  public async getAllShippingZones(): Promise<ShippingZone[]> {
    try {
      const [rows] = await db.query<ShippingZone>(
        'SELECT * FROM shipping_zones ORDER BY name ASC'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all shipping zones:', error);
      throw error;
    }
  }

  /**
   * Test Aramex rate calculation for a destination (admin diagnostic). Uses new JSON API; ClientInfo from .env.
   */
  public async testAramexShipping(
    destination: { country: string; city?: string; state?: string; postcode?: string },
    weightKg: number
  ): Promise<{ success: true; rates: Array<{ id: string; label: string; cost: number; currency: string; method: string }> }> {
    const clientInfo = getClientInfo();
    const settings = await this.getShippingSettings();
    const shipper = settings.aramexShipper;
    const shipperCountry = (clientInfo.AccountCountryCode || 'LB').toUpperCase();
    const destCountry = (destination.country || '').toUpperCase();
    const isDomestic = shipperCountry === destCountry;
    const weight = Math.max(0.5, weightKg || 1.5);
    const productGroup = isDomestic ? 'DOM' : 'EXP';
    const productType = isDomestic ? 'CDS' : 'PPX';
    logger.info('ShippingService', `[Aramex] Admin test: destination=${destination.country} ${destination.city || ''}, weightKg=${weight}, productGroup=${productGroup} productType=${productType}`);
    const result = await calculateRateJson({
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
      const notifs = result.Notifications as { Notification?: Array<{ Code?: string; Message?: string }> } | undefined;
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

  /**
   * Resolve stored shipping_method (e.g. "shipping_9999") to a human-readable label for display.
   */
  public async getShippingMethodDisplayName(shippingMethod: string | null | undefined): Promise<string> {
    if (!shippingMethod || typeof shippingMethod !== 'string') return 'Standard';
    const match = /^shipping_(\d+)$/.exec(shippingMethod.trim());
    if (!match) return shippingMethod;
    const rateId = parseInt(match[1], 10);
    if (rateId === 9999) return 'Aramex Shipping';
    const rate = await this.getShippingRateById(rateId);
    return rate?.name ?? shippingMethod;
  }

  /**
   * Get shipping rate by ID
   */
  public async getShippingRateById(rateId: number): Promise<ShippingRate | null> {
    try {
      const [rows] = await db.query<ShippingRate>(
        'SELECT * FROM shipping_rates WHERE id = ?',
        [rateId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting shipping rate by ID:', error);
      throw error;
    }
  }

  /**
   * Schedule Aramex pickup using CreatePickup JSON API with ExistingShipments (no SOAP).
   * Use when orders already have waybills (tracking numbers). Requires .env Aramex credentials.
   */
  public async schedulePickupWithExistingShipments(
    existingShipments: Array<{ trackingNumber: string; productGroup: string }>,
    pickupOptions: {
      pickupDate: Date | string;
      readyTime: Date | string;
      closingTime: Date | string;
      location?: string;
      vehicle?: string;
      comments?: string;
      reference1?: string;
    }
  ): Promise<
    | { success: true; pickupId: string; pickupGUID: string | null }
    | { success: false; error: string }
  > {
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
      const result = await createPickupJson(body);
      if (result.HasErrors) {
        const notifs = result.Notifications as { Notification?: Array<{ Message?: string }> } | undefined;
        const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => n?.Message).filter(Boolean).join('; ') : 'CreatePickup failed';
        return { success: false, error: msg };
      }
      const pickupId = result.ProcessedPickup?.ID ?? result.ProcessedPickup?.Reference1 ?? null;
      if (!pickupId) return { success: false, error: 'No pickup reference returned.' };
      return { success: true, pickupId, pickupGUID: result.ProcessedPickup?.GUID ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('ShippingService', `Schedule pickup (ExistingShipments) failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Schedule Aramex pickup for an order (legacy). Prefer schedulePickupWithExistingShipments when order already has a waybill.
   * This SOAP path is used only when scheduling without ExistingShipments (e.g. old flow). For orders with shipment created, use JSON API from Shipments page or schedulePickupWithExistingShipments.
   */
  public async schedulePickupForOrder(
    order: {
      order_number: string;
      items?: Array<{ quantity: number }>;
    },
    pickupOptions?: {
      pickupDate?: Date | string;
      readyTime?: Date | string;
      closingTime?: Date | string;
      location?: string;
      vehicle?: string;
      productGroup?: string;
      productType?: string;
      paymentType?: string;
      numberOfShipments?: number;
      numberOfPieces?: number;
      weight?: number;
      weightUnit?: string;
      comments?: string;
    }
  ): Promise<
    | { success: true; pickupId: string; pickupGUID: string | null }
    | { success: false; error: string }
  > {
    const settings = await this.getShippingSettings();
    const config = this.buildAramexConfig(settings);
    if (!config) {
      return {
        success: false,
        error: 'Aramex is not configured. Set username, password, and account in E-commerce Settings.'
      };
    }
    const numberOfPieces =
      pickupOptions?.numberOfPieces ??
      ((order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0) || 1);
    const weight = pickupOptions?.weight ?? Math.max(0.5, numberOfPieces * 0.5);
    const pickupData: AramexCreatePickupData = {
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
      readyTime:
        pickupOptions?.readyTime ??
        (() => {
          const d = new Date();
          d.setHours(10, 0, 0, 0);
          return d;
        })(),
      closingTime:
        pickupOptions?.closingTime ??
        (() => {
          const d = new Date();
          d.setHours(17, 0, 0, 0);
          return d;
        })()
    };
    try {
      const aramexService = getAramexService(config);
      const result = await aramexService.createPickup(pickupData);
      if (!result.success || !result.pickupId) {
        return {
          success: false,
          error: result?.pickupId ? 'No pickup ID returned' : 'Aramex CreatePickup failed.'
        };
      }
      return { success: true, pickupId: result.pickupId, pickupGUID: result.pickupGUID ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('ShippingService', `Schedule pickup failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Default city per country for Aramex CalculateRate when destination city is empty.
   * Aramex requires a valid city for international rate quotes; "Unknown" causes errors.
   */
  private getDefaultCityForRate(countryCode: string): string {
    const cityByCountry: Record<string, string> = {
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

  /**
   * Normalize country to ISO 2-letter code for Aramex.
   */
  private normalizeCountryCode(country: string | undefined): string {
    if (!country) return 'LB';
    const c = (country || '').trim().toUpperCase();
    
    // Already a 2-letter code
    if (c.length === 2) return c;
    
    // Common country name mappings
    const countryMap: Record<string, string> = {
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
    
    if (countryMap[c]) return countryMap[c];
    
    // Fallback to first 2 chars (not ideal but better than nothing)
    logger.warn('ShippingService', `Unknown country name "${country}", using first 2 chars: ${c.substring(0, 2)}`);
    return c.substring(0, 2);
  }

  /**
   * Build the reference test payload (same structure as test-create-shipment.ts) for comparison.
   * Returns request body without ClientInfo: { LabelInfo, Shipments, Transaction }.
   */
  private getCreateShipmentsTestPayload(): object {
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

  /** Cached map of country code (e.g. LB) -> InternationalCallingNumber (e.g. 961) from data/countries.json */
  private static countryDialCodeMap: Record<string, string> | null = null;

  private getCountryDialCode(countryCode: string): string {
    if (!countryCode || typeof countryCode !== 'string') return '';
    const code = countryCode.trim().toUpperCase();
    if (!code) return '';
    if (ShippingService.countryDialCodeMap === null) {
      try {
        const path = getDataFilePath('countries.json');
        const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
        const list = data?.countries || [];
        ShippingService.countryDialCodeMap = {};
        for (const c of list) {
          const cc = (c?.code || '').toString().trim().toUpperCase();
          const dial = (c?.InternationalCallingNumber ?? c?.dialCode ?? '').toString().trim();
          if (cc && dial && dial !== '0') ShippingService.countryDialCodeMap[cc] = dial;
        }
      } catch {
        ShippingService.countryDialCodeMap = { LB: '961', US: '1', AE: '971', SA: '966', GB: '44', FR: '33', EG: '20' };
      }
    }
    return ShippingService.countryDialCodeMap[code] || '';
  }

  /**
   * Normalize phone for Aramex: strip spaces, remove leading 0, ensure country code prefix (e.g. +961) from user's country.
   */
  private normalizePhoneForCountry(phone: string, countryCode: string): string {
    const raw = (phone || '').trim().replace(/\s/g, '');
    const normalized = raw.replace(/^0+/, '');
    if (!normalized) return '';
    if (normalized.startsWith('+')) return normalized;
    const dial = this.getCountryDialCode(countryCode);
    if (!dial) return normalized;
    if (normalized.startsWith(dial)) return '+' + normalized;
    return '+' + dial + normalized;
  }

  /**
   * Recursively replace null/undefined with '' in a payload so Aramex (VB) never receives null and throws NullReferenceException.
   * Numbers and booleans are left as-is.
   */
  private sanitizeShipmentPayload(obj: any): any {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitizeShipmentPayload(item));
    if (typeof obj === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        out[k] = v === null || v === undefined ? '' : this.sanitizeShipmentPayload(v);
      }
      return out;
    }
    return typeof obj === 'string' ? obj : String(obj);
  }

  /**
   * Create Aramex shipment for an order (generate waybill) via JSON CreateShipments API.
   * Order must have order_number, shipping_address (object or JSON), items, total_amount, payment_method.
   * ClientInfo from .env only (getClientInfo throws if missing).
   */
  public async createShipmentForOrder(order: {
    order_number: string;
    shipping_address: unknown;
    items?: Array<{ product_name?: string; quantity: number; unit_price: number }>;
    total_amount?: number;
    payment_method?: string;
    currency?: string;
  }): Promise<
    | { success: true; shipmentId: string; labelUrl: string | null; productGroup: string; productType: string; rawResponse: string; requestPayload?: string; testPayload?: string; apiUrl?: string }
    | { success: false; error: string; debug?: any; requestPayload?: string; testPayload?: string; apiUrl?: string }
  > {
    const settings = await this.getShippingSettings();
    const config = this.buildAramexConfig(settings);
    if (!config) {
      return { success: false, error: 'Aramex is not configured. Set username, password, and account in E-commerce Settings.' };
    }
    const addr =
      typeof order.shipping_address === 'string'
        ? (JSON.parse(order.shipping_address) as Record<string, string>)
        : (order.shipping_address as Record<string, string>) || {};
    const rawCountry = addr.country || (addr as any).zip_code || '';
    const countryCode = this.normalizeCountryCode(rawCountry);
    const shipperCountry = (config.shipper.country || 'LB').toString().toUpperCase();
    const isDomesticShipment = shipperCountry !== '' && (countryCode || '').toUpperCase() === shipperCountry;
    const productGroup = isDomesticShipment ? 'DOM' : 'EXP';
    const productType = isDomesticShipment ? 'CDS' : 'PPX';

    const items = order.items || [];
    const totalWeight = Math.max(0.5, items.reduce((s, i) => s + (i.quantity || 1) * 0.5, 0));
    const numberOfPieces = Math.max(1, items.reduce((s, i) => s + (i.quantity || 1), 0));
    const isCod =
      order.payment_method &&
      (String(order.payment_method).toLowerCase() === 'cash_on_delivery' ||
        String(order.payment_method).toLowerCase().includes('cash'));
    const customsValue = Number(order.total_amount) || 0;
    const currency = String(order.currency || 'USD').trim() || 'USD';
    const reportId = config.reportId || parseInt(process.env.ARAMEX_REPORT_ID || '9729', 10);

    const now = Date.now();
    const dueMs = now + 24 * 60 * 60 * 1000;

    const emptyParty = (): object => ({
      Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
      Longitude: 0, Latitude: 0, BuildingNumber: '', BuildingName: '', Floor: '', Apartment: '', POBox: '', Description: ''
    });
    const emptyContact = (): object => ({
      Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
      PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
    });

    // Shipper: same shape as test-create-shipment.ts
    const shipperAddress = { ...emptyParty(), Line1: (config.shipper.address || '').trim() || 'Origin', City: (config.shipper.city || 'Beirut').trim(), StateOrProvinceCode: shipperCountry === 'US' ? (config.shipper.state || '').trim() : '', PostCode: (config.shipper.postalcode || '').replace(/\s/g, ''), CountryCode: shipperCountry };
    const shipperName = (config.shipper.name || '').trim() || 'Shipper';
    const shipperPhone = this.normalizePhoneForCountry(config.shipper.phone || '', shipperCountry);
    const shipperContact = { ...emptyContact(), PersonName: shipperName, CompanyName: (config.shipper.company || '').trim() || shipperName, PhoneNumber1: shipperPhone, CellPhone: shipperPhone, EmailAddress: (config.shipper.email || '').trim() };
    // Consignee: required PersonName and non-empty Line1/City (Aramex ERR48 / NullRef). Support first_name/last_name, firstName/lastName, or single name.
    const first = (addr.first_name ?? (addr as any).firstName ?? '').toString().trim();
    const last = (addr.last_name ?? (addr as any).lastName ?? '').toString().trim();
    const singleName = (addr.name ?? (addr as any).full_name ?? '').toString().trim();
    const consigneeNameRaw = [first, last].filter(Boolean).join(' ') || singleName || 'Customer' || `Order ${order.order_number}`;
    const consigneeName = consigneeNameRaw.trim() || `Order ${order.order_number}`;
    const consigneeLine1 = (addr.address_line1 || (addr as any).address_line_1 || (addr as any).address || '').toString().trim();
    const consigneeCity = (addr.city || '').toString().trim();
    const consigneeState = (countryCode || '').toString().toUpperCase() === 'US' ? (addr.state || (addr as any).state || '').toString().trim() : '';
    const consigneeAddress = { ...emptyParty(), Line1: consigneeLine1 || 'N/A', Line2: (addr.address_line2 || (addr as any).address_line_2 || '').trim(), City: consigneeCity || 'N/A', StateOrProvinceCode: consigneeState, PostCode: (addr.zip_code || addr.postal_code || addr.postcode || '').toString().replace(/\s/g, ''), CountryCode: countryCode || 'LB' };
    const consigneePhone = this.normalizePhoneForCountry(addr.phone || '', countryCode || 'LB');
    const consigneeCompany = (addr.company_name ?? (addr as any).company ?? '').toString().trim() || consigneeName;
    const consigneeContact = { ...emptyContact(), PersonName: consigneeName, CompanyName: consigneeCompany, PhoneNumber1: consigneePhone, CellPhone: consigneePhone, EmailAddress: (addr.email || '').trim() };

    // Details: match Aramex expected structure. Unit 'Kg' (not 'KG'); InsuranceAmount null; include CashAdditionalAmount, CollectAmount, ContainsDangerousGoods.
    const details: Record<string, unknown> = {
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
      if (isCod && codValue > 0) details.Services = 'CODS';
    }

    // All reference/identifier fields as strings (match test); no null/undefined to avoid Aramex NullReferenceException
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
    (shipment as any).ScheduledDelivery = null;

    // Sanitize: replace null/undefined with '' so Aramex never receives null (except we restore specific fields after)
    const sanitizedShipment = this.sanitizeShipmentPayload(shipment);
    (sanitizedShipment as any).ScheduledDelivery = null;
    const det = (sanitizedShipment as any).Details;
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
    const apiUrl = getCreateShipmentsUrl();
    // Include ClientInfo in displayed payloads so the modal shows the full request (same as sent to Aramex)
    let requestPayload: string;
    let testPayload: string;
    try {
      const clientInfo = getClientInfo();
      requestPayload = JSON.stringify({ ClientInfo: clientInfo, ...requestBody }, null, 2);
      testPayload = JSON.stringify({ ClientInfo: clientInfo, ...testBody }, null, 2);
    } catch {
      requestPayload = JSON.stringify(requestBody, null, 2);
      testPayload = JSON.stringify(testBody, null, 2);
    }

    try {
      getClientInfo(); // throw if any required .env missing
      logger.info('ShippingService', `Creating shipment (JSON API) for order ${ref1}, weight: ${totalWeight}, ${productGroup}/${productType}`);
      // Log request to logs/ folder (no credentials – requestBody has no ClientInfo)
      logger.info('CreateShipmentRequest', { orderNumber: ref1, payload: requestBody });
      const rawResponse = await createShipmentsJson(requestBody);
      const parsed = parseCreateShipmentsResponse(rawResponse);
      if (parsed.hasErrors || !parsed.trackingId) {
        const detail = parsed.errorMessages?.length
          ? parsed.errorMessages.join('; ')
          : parsed.hasErrors
            ? 'Aramex CreateShipments returned errors (no messages in response).'
            : 'Aramex CreateShipments did not return a tracking number.';
        logger.error('ShippingService', `Create shipment failed for order ${order.order_number}: ${detail}. Raw response (first 500 chars): ${parsed.rawResponse.substring(0, 500)}`);
        // Log request (no credentials) and full response to logs/ when there is an error
        logger.error('CreateShipmentError', { orderNumber: ref1, requestPayload: requestBody, response: parsed.rawResponse, errorMessages: parsed.errorMessages });
        // ERR00 / NullReferenceException = Aramex server bug; show a clearer message to the user
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : '';
      logger.error('ShippingService', `Create shipment failed for order ${order.order_number}: ${message}${stack ? '. ' + stack : ''}`);
      // Log request (no credentials) and error to logs/ – no response body on exception
      logger.error('CreateShipmentException', { orderNumber: ref1, requestPayload: requestBody, error: message });
      return { success: false, error: message, debug: { message, stack }, requestPayload, testPayload, apiUrl };
    }
  }

  /**
   * Get Aramex shipper address/contact and account entity for building CreatePickup payload (e.g. admin Shipments page).
   */
  public async getAramexPickupDefaults(): Promise<{
    PickupAddress: Record<string, unknown>;
    PickupContact: Record<string, unknown>;
    OriginEntity: string;
  } | null> {
    const settings = await this.getShippingSettings();
    const config = this.buildAramexConfig(settings);
    if (!config) return null;
    const shipper = config.shipper;
    const emptyAddr = (): Record<string, unknown> => ({
      Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
      Longitude: 0, Latitude: 0, BuildingNumber: null, BuildingName: null, Floor: null, Apartment: null, POBox: null, Description: null
    });
    const emptyContact = (): Record<string, unknown> => ({
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

  /**
   * Get waybill label URL for an order that already has a tracking number (Aramex PrintLabel).
   */
  public async getWaybillLabelForOrder(order: {
    order_number: string;
    tracking_number: string | null;
  }): Promise<{ success: true; labelUrl: string } | { success: false; error: string }> {
    if (!order.tracking_number || !order.tracking_number.trim()) {
      return { success: false, error: 'No tracking number. Generate waybill first.' };
    }
    const settings = await this.getShippingSettings();
    const config = this.buildAramexConfig(settings);
    if (!config) {
      return { success: false, error: 'Aramex is not configured.' };
    }
    try {
      const aramexService = getAramexService(config);
      const result = await aramexService.printLabel(
        order.tracking_number.trim(),
        order.order_number,
        null
      );
      if (!result.success || !result.labelUrl) {
        return { success: false, error: 'Could not get label URL from Aramex.' };
      }
      return { success: true, labelUrl: result.labelUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('ShippingService', `Print waybill failed: ${message}`);
      return { success: false, error: message };
    }
  }
}

export default ShippingService.getInstance();

