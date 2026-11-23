"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderShipmentService = void 0;
const database_1 = require("../../src/config/database");
class OrderShipmentService {
    constructor() { }
    static getInstance() {
        if (!OrderShipmentService.instance) {
            OrderShipmentService.instance = new OrderShipmentService();
        }
        return OrderShipmentService.instance;
    }
    async getShipmentByOrderId(orderId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM order_shipments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', [orderId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting shipment by order ID:', error);
            throw error;
        }
    }
    async getOrCreateShipment(orderId) {
        try {
            let shipment = await this.getShipmentByOrderId(orderId);
            if (!shipment) {
                const [result] = await database_1.db.query('INSERT INTO order_shipments (order_id, status) VALUES (?, ?)', [orderId, 'pending']);
                const shipmentId = result.insertId;
                shipment = await this.getShipmentById(shipmentId);
                if (!shipment)
                    throw new Error('Failed to create shipment');
            }
            return shipment;
        }
        catch (error) {
            console.error('Error getting or creating shipment:', error);
            throw error;
        }
    }
    async getShipmentById(shipmentId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM order_shipments WHERE id = ?', [shipmentId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting shipment by ID:', error);
            throw error;
        }
    }
    async updatePickupDetails(orderId, data) {
        try {
            const shipment = await this.getOrCreateShipment(orderId);
            await database_1.db.query(`UPDATE order_shipments SET 
          pickup_reference = ?,
          pickup_guid = ?,
          pickup_date = ?,
          pickup_ready_time = ?,
          pickup_closing_time = ?,
          pickup_location = ?,
          pickup_vehicle = ?,
          pickup_scheduled_at = NOW(),
          product_group = ?,
          product_type = ?,
          payment_type = ?,
          number_of_pieces = ?,
          total_weight = ?,
          weight_unit = ?,
          comments = ?,
          status = 'pickup_scheduled',
          updated_at = NOW()
        WHERE id = ?`, [
                data.pickup_reference,
                data.pickup_guid ?? null,
                data.pickup_date,
                data.pickup_ready_time,
                data.pickup_closing_time,
                data.pickup_location ?? null,
                data.pickup_vehicle ?? null,
                data.product_group ?? null,
                data.product_type ?? null,
                data.payment_type ?? null,
                data.number_of_pieces ?? null,
                data.total_weight ?? null,
                data.weight_unit ?? 'kg',
                data.comments ?? null,
                shipment.id
            ]);
        }
        catch (error) {
            console.error('Error updating pickup details:', error);
            throw error;
        }
    }
    async updateTrackingDetails(orderId, data) {
        try {
            const shipment = await this.getOrCreateShipment(orderId);
            await database_1.db.query(`UPDATE order_shipments SET 
          tracking_number = ?,
          waybill_label_url = ?,
          create_shipment_response = ?,
          shipment_created_at = NOW(),
          description_of_goods = ?,
          product_group = ?,
          product_type = ?,
          status = 'shipment_created',
          updated_at = NOW()
        WHERE id = ?`, [
                data.tracking_number,
                data.waybill_label_url ?? null,
                data.create_shipment_response ?? null,
                data.description_of_goods ?? null,
                data.product_group ?? null,
                data.product_type ?? null,
                shipment.id
            ]);
        }
        catch (error) {
            console.error('Error updating tracking details:', error);
            throw error;
        }
    }
    async getOrdersWithShipmentCreated(filters) {
        const conditions = [
            "os.tracking_number IS NOT NULL AND TRIM(os.tracking_number) != ''"
        ];
        const params = [];
        if (filters?.order_number && String(filters.order_number).trim()) {
            conditions.push('o.order_number LIKE ?');
            params.push(`%${String(filters.order_number).trim()}%`);
        }
        if (filters?.customer && String(filters.customer).trim()) {
            conditions.push('o.customer_email LIKE ?');
            params.push(`%${String(filters.customer).trim()}%`);
        }
        if (filters?.tracking && String(filters.tracking).trim()) {
            conditions.push('os.tracking_number LIKE ?');
            params.push(`%${String(filters.tracking).trim()}%`);
        }
        if (filters?.pickup_code && String(filters.pickup_code).trim()) {
            conditions.push('(os.pickup_reference IS NOT NULL AND os.pickup_reference LIKE ?)');
            params.push(`%${String(filters.pickup_code).trim()}%`);
        }
        const shippedFilter = filters?.shipped ?? 'not_shipped';
        if (shippedFilter === 'not_shipped') {
            conditions.push("(os.pickup_reference IS NULL OR TRIM(os.pickup_reference) = '')");
        }
        else if (shippedFilter === 'shipped') {
            conditions.push("(os.pickup_reference IS NOT NULL AND TRIM(os.pickup_reference) != '')");
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT o.id AS order_id, o.order_number, o.customer_email, o.status AS order_status,
       os.tracking_number, os.product_group, os.product_type, os.total_weight, os.id AS shipment_id,
       os.pickup_reference, os.status AS shipment_status
       FROM orders o
       INNER JOIN order_shipments os ON os.order_id = o.id
       ${whereClause}
       ORDER BY (CASE WHEN os.pickup_reference IS NULL OR TRIM(os.pickup_reference) = '' THEN 0 ELSE 1 END), o.created_at DESC`;
        const [rows] = await database_1.db.query(sql, params);
        return rows || [];
    }
    async updateShipmentStatus(orderId, status) {
        try {
            const shipment = await this.getShipmentByOrderId(orderId);
            if (shipment) {
                await database_1.db.query('UPDATE order_shipments SET status = ?, updated_at = NOW() WHERE id = ?', [status, shipment.id]);
            }
        }
        catch (error) {
            console.error('Error updating shipment status:', error);
            throw error;
        }
    }
}
exports.OrderShipmentService = OrderShipmentService;
//# sourceMappingURL=orderShipmentService.js.map