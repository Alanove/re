export interface AramexRateRequest {
    originAddress: {
        city: string;
        countryCode: string;
    };
    destinationAddress: {
        city: string;
        countryCode: string;
    };
    weight: number;
    numberOfItems: number;
}
export interface AramexRateResponse {
    success: boolean;
    rate?: number;
    currency?: string | undefined;
    error?: string | undefined;
}
export declare class AramexService {
    private static instance;
    private config;
    private constructor();
    static getInstance(): AramexService;
    calculateRate(data: AramexRateRequest): Promise<AramexRateResponse>;
    private constructSoapRequest;
    private parseSoapResponse;
}
declare const _default: AramexService;
export default _default;
//# sourceMappingURL=aramexService.d.ts.map