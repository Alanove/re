export interface Order {
    id: number;
    order_number: string;
    customer_id: number | null;
    customer_email: string;
    customer_phone: string | null;
    status: string;
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    currency: string;
    payment_method: string;
    payment_status: string;
    shipping_method: string | null;
    tracking_number: string | null;
    waybill_label_url: string | null;
    shipping_address: string;
    billing_address: string | null;
    discount_code: string | null;
    notes: string | null;
    internal_notes: string | null;
    shipped_at: Date | null;
    delivered_at: Date | null;
    created_at: Date;
    updated_at: Date;
    item_count?: number;
}
export interface OrderItem {
    id: number;
    order_id: number;
    product_id: number;
    variant_id: number | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at: Date;
    variant_attributes?: string | Record<string, string> | null;
    variant_sku?: string | null;
}
export interface OrderWithItems extends Order {
    items?: OrderItem[];
}
export interface CreateOrderData {
    customer_id?: number | null | undefined;
    customer_email: string;
    customer_phone?: string | undefined;
    shipping_address: any;
    billing_address?: any | undefined;
    items: Array<{
        product_id: number;
        variant_id?: number | null | undefined;
        quantity: number;
        unit_price: number;
    }>;
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    currency?: string | undefined;
    payment_method: string;
    shipping_method?: string | undefined;
    discount_code?: string | undefined;
    notes?: string | undefined;
}
export declare class OrderService {
    private static instance;
    private constructor();
    static getInstance(): OrderService;
    private generateOrderNumber;
    createOrder(orderData: CreateOrderData): Promise<Order>;
    getOrderById(orderId: number): Promise<Order | null>;
    getOrderByNumber(orderNumber: string): Promise<Order | null>;
    getOrderWithItems(orderId: number): Promise<OrderWithItems | null>;
    getOrderItems(orderId: number): Promise<OrderItem[]>;
    updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<void>;
    updatePaymentStatus(orderId: number, paymentStatus: string): Promise<void>;
    addOrderNote(orderId: number, note: string): Promise<void>;
    attachOrderToCustomer(orderId: number, customerId: number): Promise<boolean>;
    attachGuestOrdersToCustomer(customerId: number, email: string): Promise<number>;
    getCustomerOrders(customerId: number, limit?: number): Promise<Order[]>;
    getOrderStatusHistory(orderId: number): Promise<Array<{
        id: number;
        status: string;
        notes: string | null;
        created_by: number | null;
        created_at: Date;
    }>>;
}
declare const _default: OrderService;
export default _default;
//# sourceMappingURL=orderService.d.ts.map