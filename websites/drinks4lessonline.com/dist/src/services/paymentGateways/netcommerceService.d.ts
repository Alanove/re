import { IPaymentGateway, PaymentData, PaymentResult } from '../paymentService';
interface NetcommerceConfig {
    merchantId: string;
    apiPassword: string;
    gatewayUrl: string;
    testMode: boolean;
    merchantName: string;
    partnerSolutionId: string;
    merchantEmail?: string;
    merchantPhone?: string;
    merchantLogoUrl?: string;
    merchantAddressLine1?: string;
    merchantAddressLine2?: string;
}
export declare class NetCommerceService implements IPaymentGateway {
    private config;
    constructor(config?: Partial<NetcommerceConfig>);
    processPayment(data: PaymentData): Promise<PaymentResult>;
    retrieveSession(sessionId: string): Promise<{
        success: boolean;
        result?: string;
        order?: any;
        error?: string;
    }>;
    retrieveOrder(gatewayOrderId: string): Promise<{
        success: boolean;
        result?: string;
        status?: string;
        order?: any;
        error?: string;
    }>;
    refundPayment(transactionId: string, amount: number): Promise<PaymentResult>;
    getPaymentStatus(transactionId: string): Promise<string>;
}
export default NetCommerceService;
//# sourceMappingURL=netcommerceService.d.ts.map