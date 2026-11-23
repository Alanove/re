"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashOnDeliveryService = void 0;
class CashOnDeliveryService {
    async processPayment(data) {
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
    async refundPayment(transactionId, amount) {
        return {
            success: false,
            error: 'Refunds are not applicable for Cash on Delivery orders. Please process manually.'
        };
    }
    async getPaymentStatus(transactionId) {
        return 'pending';
    }
}
exports.CashOnDeliveryService = CashOnDeliveryService;
exports.default = CashOnDeliveryService;
//# sourceMappingURL=cashOnDeliveryService.js.map