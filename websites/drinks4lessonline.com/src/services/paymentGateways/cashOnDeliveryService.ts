import { IPaymentGateway, PaymentData, PaymentResult } from '../paymentService';

/**
 * Cash on Delivery Payment Gateway
 * This is a manual payment method - no actual payment processing occurs
 */
export class CashOnDeliveryService implements IPaymentGateway {
  /**
   * Process payment (for COD, we just confirm the order)
   */
  public async processPayment(data: PaymentData): Promise<PaymentResult> {
    // Cash on Delivery doesn't require actual payment processing
    // The order will be marked as pending payment and will be collected on delivery
    return {
      success: true,
      transactionId: `COD-${data.orderId}-${Date.now()}`,
      gatewayResponse: {
        method: 'cash_on_delivery',
        status: 'pending',
        message: 'Payment will be collected on delivery'
      }
    };
  }

  /**
   * Refund payment (not applicable for COD)
   */
  public async refundPayment(transactionId: string, amount: number): Promise<PaymentResult> {
    return {
      success: false,
      error: 'Refunds are not applicable for Cash on Delivery orders. Please process manually.'
    };
  }

  /**
   * Get payment status
   */
  public async getPaymentStatus(transactionId: string): Promise<string> {
    // COD payments are always pending until collected
    return 'pending';
  }
}

export default CashOnDeliveryService;

