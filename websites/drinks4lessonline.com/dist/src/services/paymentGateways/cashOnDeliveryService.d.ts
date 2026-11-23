import { IPaymentGateway, PaymentData, PaymentResult } from '../paymentService';
export declare class CashOnDeliveryService implements IPaymentGateway {
    processPayment(data: PaymentData): Promise<PaymentResult>;
    refundPayment(transactionId: string, amount: number): Promise<PaymentResult>;
    getPaymentStatus(transactionId: string): Promise<string>;
}
export default CashOnDeliveryService;
//# sourceMappingURL=cashOnDeliveryService.d.ts.map