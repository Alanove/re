export interface OrderShipment {
    id: number;
    order_id: number;
    tracking_number: string | null;
    waybill_label_url: string | null;
    create_shipment_response: string | null;
    shipment_created_at: Date | null;
    pickup_reference: string | null;
    pickup_guid: string | null;
    pickup_date: Date | null;
    pickup_ready_time: string | null;
    pickup_closing_time: string | null;
    pickup_location: string | null;
    pickup_vehicle: string | null;
    pickup_scheduled_at: Date | null;
    product_group: string | null;
    product_type: string | null;
    payment_type: string | null;
    number_of_pieces: number | null;
    total_weight: number | null;
    weight_unit: string | null;
    description_of_goods: string | null;
    comments: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}
export interface CreateShipmentData {
    order_id: number;
    pickup_date?: Date | string;
    pickup_ready_time?: string;
    pickup_closing_time?: string;
    pickup_location?: string;
    pickup_vehicle?: string;
    product_group?: string;
    product_type?: string;
    payment_type?: string;
    number_of_pieces?: number;
    total_weight?: number;
    weight_unit?: string;
    comments?: string;
}
export declare class OrderShipmentService {
    private static instance;
    private constructor();
    static getInstance(): OrderShipmentService;
    getShipmentByOrderId(orderId: number): Promise<OrderShipment | null>;
    getOrCreateShipment(orderId: number): Promise<OrderShipment>;
    getShipmentById(shipmentId: number): Promise<OrderShipment | null>;
    updatePickupDetails(orderId: number, data: {
        pickup_reference: string;
        pickup_guid?: string | null;
        pickup_date: Date | string;
        pickup_ready_time: string;
        pickup_closing_time: string;
        pickup_location?: string;
        pickup_vehicle?: string;
        product_group?: string;
        product_type?: string;
        payment_type?: string;
        number_of_pieces?: number;
        total_weight?: number;
        weight_unit?: string;
        comments?: string;
    }): Promise<void>;
    updateTrackingDetails(orderId: number, data: {
        tracking_number: string;
        waybill_label_url?: string | null;
        description_of_goods?: string;
        create_shipment_response?: string | null;
        product_group?: string | null;
        product_type?: string | null;
    }): Promise<void>;
    getOrdersWithShipmentCreated(filters?: {
        order_number?: string;
        customer?: string;
        tracking?: string;
        pickup_code?: string;
        shipped?: 'all' | 'shipped' | 'not_shipped';
    }): Promise<Array<{
        order_id: number;
        order_number: string;
        customer_email: string;
        tracking_number: string;
        product_group: string | null;
        product_type: string | null;
        total_weight: number | null;
        shipment_id: number;
        order_status: string;
        pickup_reference: string | null;
        shipment_status: string;
    }>>;
    updateShipmentStatus(orderId: number, status: string): Promise<void>;
}
//# sourceMappingURL=orderShipmentService.d.ts.map