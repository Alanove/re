export interface AramexShipper {
    name: string;
    company: string;
    address: string;
    city: string;
    state: string;
    postalcode: string;
    country: string;
    phone: string;
    email: string;
}
export interface AramexConfig {
    accountCountryCode: string;
    accountEntity: string;
    accountNumber: string;
    accountPin: string;
    userName: string;
    password: string;
    shipper: AramexShipper;
    allowedDomesticMethods: Record<string, string>;
    allowedInternationalMethods: Record<string, string>;
    sandbox: boolean;
    preferredCurrency: string;
    roundUpPrice: boolean;
    reportId: number;
    logging: boolean;
}
export interface AramexRate {
    id: string;
    label: string;
    cost: number;
    currency: string;
    method: string;
    productGroup: string;
}
export interface AramexCreatePickupData {
    reference1: string;
    pickupDate?: Date | string;
    readyTime?: Date | string;
    closingTime?: Date | string;
    location?: string;
    vehicle?: string;
    comments?: string;
    productGroup?: string;
    productType?: string;
    paymentType?: string;
    numberOfShipments?: number;
    numberOfPieces?: number;
    weight?: number;
    weightUnit?: string;
    contact?: {
        personName?: string;
        companyName?: string;
        name?: string;
        company?: string;
        phone?: string;
        cellPhone?: string;
        email?: string;
    };
    address?: {
        line1?: string;
        city?: string;
        stateOrProvinceCode?: string;
        state?: string;
        postCode?: string;
        postalcode?: string;
        countryCode?: string;
        country?: string;
    };
}
export interface AramexCreatePickupResult {
    success: boolean;
    pickupId?: string | null;
    pickupGUID?: string | null;
    reference1?: string | null;
    reference2?: string | null;
}
export interface IAramexService {
    calculateShipping(packageData: AramexPackageData, weightUnit?: string, dimensionUnit?: string, options?: {
        throwFirstError?: boolean;
    }): Promise<AramexRate[]>;
    createShipment(shipmentData: unknown): Promise<{
        success: boolean;
        shipmentId?: string;
        labelUrl?: string | null;
    }>;
    createPickup(pickupData: AramexCreatePickupData): Promise<AramexCreatePickupResult>;
    trackShipments(shipmentNumbers: string | string[], getLastUpdateOnly?: boolean): Promise<unknown>;
    printLabel(shipmentNumber: string, reference1?: string, reportId?: number | null): Promise<{
        success: boolean;
        labelUrl?: string | null;
    }>;
}
export interface AramexPackageData {
    items: Array<{
        name?: string;
        quantity: number;
        weight: number;
        length?: number;
        width?: number;
        height?: number;
        regularPrice?: number;
        salePrice?: number;
        currency?: string;
    }>;
    destination: {
        country: string;
        state?: string;
        city: string;
        postcode?: string;
    };
}
export declare const DEFAULT_INTERNATIONAL_METHODS: Record<string, string>;
export declare const DEFAULT_DOMESTIC_METHODS: Record<string, string>;
export declare function getAramexService(config: AramexConfig): IAramexService;
export { getClientInfo } from './clientInfo';
export { fetchCountries, fetchCities, fetchStates, calculateRate as calculateRateJson, createShipments as createShipmentsJson, getCreateShipmentsUrl, parseCreateShipmentsResponse, trackShipments as trackShipmentsJson, createPickup as createPickupJson } from './aramexApiClient';
export type { AramexClientInfo } from './clientInfo';
export type { FetchCountriesResponse, FetchCitiesResponse, FetchStatesResponse, CalculateRateResponse, CreateShipmentsResponse, ParsedCreateShipmentsResult, TrackShipmentsResponse, CreatePickupResponse } from './aramexApiClient';
//# sourceMappingURL=index.d.ts.map