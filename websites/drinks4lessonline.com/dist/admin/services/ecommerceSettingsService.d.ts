import { ShippingZone, ShippingRate } from '../../src/services/shippingService';
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
    shipping_test_mode?: boolean;
    aramex_shipper?: AramexShipperSettings;
    aramex_account_entity?: string;
    aramex_account_country_code?: string;
    aramex_account_number?: string;
    aramex_account_pin?: string;
    aramex_username?: string;
    aramex_password?: string;
    multi_price_display?: 'lowest' | 'starting' | 'range';
    facebook_app_id?: string;
}
export declare class EcommerceSettingsService {
    private static instance;
    private constructor();
    static getInstance(): EcommerceSettingsService;
    getSettings(): Promise<EcommerceSettings>;
    updateSettings(settings: Partial<EcommerceSettings>): Promise<void>;
    getAllShippingZones(): Promise<ShippingZone[]>;
    getShippingZoneById(id: number): Promise<ShippingZone | null>;
    createShippingZone(data: {
        name: string;
        description?: string;
        countries: string[];
        is_active?: boolean;
    }): Promise<ShippingZone>;
    updateShippingZone(id: number, data: Partial<{
        name: string;
        description: string;
        countries: string[];
        is_active: boolean;
    }>): Promise<ShippingZone>;
    deleteShippingZone(id: number): Promise<void>;
    getShippingRatesForZone(zoneId: number): Promise<ShippingRate[]>;
    createShippingRate(data: {
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
    }): Promise<ShippingRate>;
    updateShippingRate(id: number, data: Partial<{
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
    }>): Promise<ShippingRate>;
    deleteShippingRate(id: number): Promise<void>;
    getPaymentMethods(): Promise<any[]>;
    updatePaymentMethod(id: number, data: Partial<{
        name: string;
        description: string;
        config: any;
        is_active: boolean;
    }>): Promise<void>;
}
//# sourceMappingURL=ecommerceSettingsService.d.ts.map