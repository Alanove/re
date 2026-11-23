import { type AramexClientInfo } from './clientInfo';
export declare function getCreateShipmentsUrl(): string;
export interface FetchCountriesResponse {
    HasErrors?: boolean;
    Notifications?: {
        Notification?: Array<{
            Code?: string;
            Message?: string;
        }>;
    };
    Countries?: {
        Country?: Array<{
            Code?: string;
            Name?: string;
        }>;
    };
}
export interface FetchCitiesResponse {
    HasErrors?: boolean;
    Notifications?: {
        Notification?: Array<{
            Code?: string;
            Message?: string;
        }>;
    };
    Cities?: {
        string?: string[];
    } | string[];
}
export interface StateItem {
    Code?: string;
    Name?: string;
}
export interface FetchStatesResponse {
    HasErrors?: boolean;
    Notifications?: {
        Notification?: Array<{
            Code?: string;
            Message?: string;
        }>;
    };
    States?: StateItem[] | {
        string?: string[];
    };
}
export interface CalculateRateResponse {
    HasErrors?: boolean;
    Notifications?: {
        Notification?: Array<{
            Code?: string;
            Message?: string;
        }>;
    };
    TotalAmount?: {
        Value?: number;
        CurrencyCode?: string;
    };
}
export interface CreateShipmentsResponse {
    HasErrors?: boolean;
    Notifications?: unknown;
    Shipments?: {
        ProcessedShipment?: Array<{
            ID?: string;
            Reference1?: string;
            ShipmentLabel?: {
                LabelURL?: string;
            };
        }> | {
            ID?: string;
            Reference1?: string;
            ShipmentLabel?: {
                LabelURL?: string;
            };
        };
    };
}
export interface TrackShipmentsResponse {
    HasErrors?: boolean;
    Notifications?: unknown;
    TrackingResults?: unknown;
}
export interface CreatePickupResponse {
    HasErrors?: boolean;
    Notifications?: unknown;
    ProcessedPickup?: {
        ID?: string;
        GUID?: string;
        Reference1?: string;
    };
}
export declare function fetchCountries(): Promise<FetchCountriesResponse>;
export declare function fetchCities(countryCode: string, _state?: string, nameStartsWith?: string): Promise<FetchCitiesResponse>;
export declare function fetchStates(countryCode: string): Promise<FetchStatesResponse>;
export declare function calculateRate(params: {
    originAddress: {
        Line1?: string;
        City: string;
        StateOrProvinceCode?: string;
        PostCode?: string;
        CountryCode: string;
    };
    destinationAddress: {
        Line1?: string;
        City: string;
        StateOrProvinceCode?: string;
        PostCode?: string;
        CountryCode: string;
    };
    shipmentDetails: {
        ActualWeight: {
            Unit: string;
            Value: number;
        };
        ChargeableWeight?: {
            Unit: string;
            Value: number;
        } | null;
        Dimensions?: {
            Length: number;
            Width: number;
            Height: number;
            Unit: string;
        } | null;
        NumberOfPieces: number;
        ProductGroup: string;
        ProductType: string;
        PaymentType: string;
        PaymentOptions?: string;
        GoodsOriginCountry?: string | null;
        DescriptionOfGoods?: string | null;
        CustomsValueAmount?: {
            CurrencyCode: string;
            Value: number;
        } | null;
        CashOnDeliveryAmount?: {
            CurrencyCode: string;
            Value: number;
        } | null;
        Services?: string;
    };
    preferredCurrencyCode?: string;
}): Promise<CalculateRateResponse>;
export declare function createShipments(body: {
    ClientInfo?: AramexClientInfo;
    LabelInfo: {
        ReportID: number;
        ReportType: string;
    };
    Shipments: object[];
    Transaction: object;
}): Promise<CreateShipmentsResponse | string>;
export interface ParsedCreateShipmentsResult {
    trackingId: string | null;
    labelUrl: string | null;
    hasErrors: boolean;
    rawResponse: string;
    errorMessages: string[];
}
export declare function parseCreateShipmentsResponse(raw: CreateShipmentsResponse | string): ParsedCreateShipmentsResult;
export declare function trackShipments(shipmentNumbers: string[], getLastTrackingUpdateOnly?: boolean): Promise<TrackShipmentsResponse>;
export declare function createPickup(body: object): Promise<CreatePickupResponse>;
//# sourceMappingURL=aramexApiClient.d.ts.map