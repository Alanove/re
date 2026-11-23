import { Order, OrderWithItems } from '../../src/services/orderService';
export declare class OrderManagementService {
    private static instance;
    private constructor();
    static getInstance(): OrderManagementService;
    getAllOrders(page?: number, limit?: number, filters?: {
        status?: string;
        payment_status?: string;
        payment_type?: string;
        customer_id?: number;
        date_from?: string;
        date_to?: string;
        search?: string;
    }): Promise<{
        orders: Order[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getOrderWithItems(orderId: number): Promise<OrderWithItems | null>;
    updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<void>;
    addOrderNote(orderId: number, note: string, isInternal?: boolean): Promise<void>;
    updateOrderNotes(orderId: number, internalNotes: string): Promise<void>;
    updateOrderTracking(orderId: number, trackingNumber: string, waybillLabelUrl?: string | null): Promise<void>;
    updatePaymentStatus(orderId: number, paymentStatus: string): Promise<void>;
    isCashOnDelivery(order: Order): boolean;
    getProductsWithVariantsForOrder(search?: string): Promise<Array<{
        id: number;
        name: string;
        sku: string | null;
        variants: Array<{
            id: number | null;
            name: string;
            sku: string | null;
            price: number;
        }>;
    }>>;
    updateOrderCart(orderId: number, items: Array<{
        id?: number;
        product_id: number;
        variant_id: number | null;
        quantity: number;
        unit_price: number;
    }>, shippingAmount?: number): Promise<void>;
    getOrderStatistics(dateFrom?: string, dateTo?: string): Promise<{
        totalOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        ordersByStatus: Record<string, number>;
    }>;
}
declare const _default: OrderManagementService;
export default _default;
//# sourceMappingURL=orderManagementService.d.ts.map