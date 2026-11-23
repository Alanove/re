export interface ShippingZone {
    id: number;
    name: string;
    description: string | null;
    countries: string;
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
export interface AvailableShippingRatesResult {
    rates: ShippingCalculation[];
    ratesError?: 'carrier_unavailable';
}
export interface CartShippingData {
    subtotal: number;
    totalPrice: number;
    itemCount: number;
    totalWeight: number;
    country: string;
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
    defaultShippingZoneId?: number | null;
    aramexShipper?: {
        name?: string;
        company?: string;
        address?: string;
        city?: string;
        state?: string;
        postalcode?: string;
        country?: string;
        phone?: string;
        email?: string;
    };
    aramexAccountEntity?: string;
    aramexAccountCountryCode?: string;
    aramexAccountNumber?: string;
    aramexAccountPin?: string;
    aramexUsername?: string;
    aramexPassword?: string;
}
export declare class ShippingService {
    private static instance;
    private constructor();
    static getInstance(): ShippingService;
    getShippingZoneForCountry(country: string): Promise<ShippingZone | null>;
    getShippingZoneById(zoneId: number): Promise<ShippingZone | null>;
    getShippingRatesForZone(zoneId: number): Promise<ShippingRate[]>;
    getAvailableShippingRates(cartData: CartShippingData): Promise<AvailableShippingRatesResult>;
    private getShippingSettings;
    private buildAramexConfig;
    private cartDataToAramexPackage;
    private getAramexFallbackRate;
    calculateShippingCost(rateId: number, cartData: CartShippingData): Promise<number>;
    getAllShippingZones(): Promise<ShippingZone[]>;
    testAramexShipping(destination: {
        country: string;
        city?: string;
        state?: string;
        postcode?: string;
    }, weightKg: number): Promise<{
        success: true;
        rates: Array<{
            id: string;
            label: string;
            cost: number;
            currency: string;
            method: string;
        }>;
    }>;
    getShippingMethodDisplayName(shippingMethod: string | null | undefined): Promise<string>;
    getShippingRateById(rateId: number): Promise<ShippingRate | null>;
    schedulePickupWithExistingShipments(existingShipments: Array<{
        trackingNumber: string;
        productGroup: string;
    }>, pickupOptions: {
        pickupDate: Date | string;
        readyTime: Date | string;
        closingTime: Date | string;
        location?: string;
        vehicle?: string;
        comments?: string;
        reference1?: string;
    }): Promise<{
        success: true;
        pickupId: string;
        pickupGUID: string | null;
    } | {
        success: false;
        error: string;
    }>;
    schedulePickupForOrder(order: {
        order_number: string;
        items?: Array<{
            quantity: number;
        }>;
    }, pickupOptions?: {
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
    }): Promise<{
        success: true;
        pickupId: string;
        pickupGUID: string | null;
    } | {
        success: false;
        error: string;
    }>;
    private getDefaultCityForRate;
    private normalizeCountryCode;
    private getCreateShipmentsTestPayload;
    private static countryDialCodeMap;
    private getCountryDialCode;
    private normalizePhoneForCountry;
    private sanitizeShipmentPayload;
    createShipmentForOrder(order: {
        order_number: string;
        shipping_address: unknown;
        items?: Array<{
            product_name?: string;
            quantity: number;
            unit_price: number;
        }>;
        total_amount?: number;
        payment_method?: string;
        currency?: string;
    }): Promise<{
        success: true;
        shipmentId: string;
        labelUrl: string | null;
        productGroup: string;
        productType: string;
        rawResponse: string;
        requestPayload?: string;
        testPayload?: string;
        apiUrl?: string;
    } | {
        success: false;
        error: string;
        debug?: any;
        requestPayload?: string;
        testPayload?: string;
        apiUrl?: string;
    }>;
    getAramexPickupDefaults(): Promise<{
        PickupAddress: Record<string, unknown>;
        PickupContact: Record<string, unknown>;
        OriginEntity: string;
    } | null>;
    getWaybillLabelForOrder(order: {
        order_number: string;
        tracking_number: string | null;
    }): Promise<{
        success: true;
        labelUrl: string;
    } | {
        success: false;
        error: string;
    }>;
}
declare const _default: ShippingService;
export default _default;
//# sourceMappingURL=shippingService.d.ts.map