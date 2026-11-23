export interface PaymentMethod {
    id: number;
    name: string;
    code: string;
    type: 'gateway' | 'manual';
    description: string | null;
    config: string | null;
    is_active: boolean;
    order_index: number;
    created_at: Date;
    updated_at: Date;
}
export interface BankDebugReport {
    requestSentAt: string;
    requestUrl: string;
    requestMethod: string;
    requestHeaders: Record<string, string>;
    requestBody: unknown;
    responseReceivedAt: string;
    responseStatus: number;
    responseBody: unknown;
    redirectUrl?: string;
    redirectAt?: string;
}
export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    error?: string;
    gatewayResponse?: any;
    redirectUrl?: string;
    sessionId?: string;
    gatewayOrderId?: string;
    bankDebugReport?: BankDebugReport;
}
export interface PaymentData {
    orderId: number;
    amount: number;
    currency: string;
    customerEmail: string;
    customerName?: string;
    customerPhone?: string;
    billingAddress?: any;
    paymentMethodId: number;
    returnUrl?: string;
    cancelUrl?: string;
    baseUrl?: string;
    cardToken?: string;
    cardNumber?: string;
    cardExpiry?: string;
    cardCvv?: string;
    cardholderName?: string;
}
export interface IPaymentGateway {
    processPayment(data: PaymentData): Promise<PaymentResult>;
    refundPayment(transactionId: string, amount: number): Promise<PaymentResult>;
    getPaymentStatus(transactionId: string): Promise<string>;
}
export declare class PaymentService {
    private static instance;
    private gateways;
    private constructor();
    private initializeGateways;
    static getInstance(): PaymentService;
    registerGateway(code: string, gateway: IPaymentGateway): void;
    private isLebanon;
    getActivePaymentMethods(countryCode?: string): Promise<PaymentMethod[]>;
    getPaymentMethodByCode(code: string): Promise<PaymentMethod | null>;
    getPaymentMethodById(id: number): Promise<PaymentMethod | null>;
    processPayment(data: PaymentData): Promise<PaymentResult>;
    recordTransaction(orderId: number, paymentMethodId: number, amount: number, currency: string, status?: string, transactionId?: string, gatewayResponse?: any): Promise<number>;
    getTransaction(transactionId: number): Promise<any>;
    getOrderTransactions(orderId: number): Promise<any[]>;
    initializeDefaultPaymentMethods(): Promise<void>;
}
declare const _default: PaymentService;
export default _default;
//# sourceMappingURL=paymentService.d.ts.map