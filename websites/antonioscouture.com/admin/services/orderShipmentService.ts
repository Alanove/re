import { db } from '../../src/config/database';

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
  pickup_ready_time: string | null; // TIME as string HH:MM:SS
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

export class OrderShipmentService {
  private static instance: OrderShipmentService;

  private constructor() {}

  public static getInstance(): OrderShipmentService {
    if (!OrderShipmentService.instance) {
      OrderShipmentService.instance = new OrderShipmentService();
    }
    return OrderShipmentService.instance;
  }

  /**
   * Get shipment by order ID
   */
  public async getShipmentByOrderId(orderId: number): Promise<OrderShipment | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM order_shipments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
        [orderId]
      );
      return rows.length > 0 ? (rows[0] as OrderShipment) : null;
    } catch (error) {
      console.error('Error getting shipment by order ID:', error);
      throw error;
    }
  }

  /**
   * Create or get existing shipment for order
   */
  public async getOrCreateShipment(orderId: number): Promise<OrderShipment> {
    try {
      let shipment = await this.getShipmentByOrderId(orderId);
      if (!shipment) {
        const [result] = await db.query<any>(
          'INSERT INTO order_shipments (order_id, status) VALUES (?, ?)',
          [orderId, 'pending']
        );
        const shipmentId = (result as any).insertId;
        shipment = await this.getShipmentById(shipmentId);
        if (!shipment) throw new Error('Failed to create shipment');
      }
      return shipment;
    } catch (error) {
      console.error('Error getting or creating shipment:', error);
      throw error;
    }
  }

  /**
   * Get shipment by ID
   */
  public async getShipmentById(shipmentId: number): Promise<OrderShipment | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM order_shipments WHERE id = ?',
        [shipmentId]
      );
      return rows.length > 0 ? (rows[0] as OrderShipment) : null;
    } catch (error) {
      console.error('Error getting shipment by ID:', error);
      throw error;
    }
  }

  /**
   * Update pickup details when pickup is scheduled
   */
  public async updatePickupDetails(
    orderId: number,
    data: {
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
    }
  ): Promise<void> {
    try {
      const shipment = await this.getOrCreateShipment(orderId);
      await db.query(
        `UPDATE order_shipments SET 
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
        WHERE id = ?`,
        [
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
        ]
      );
    } catch (error) {
      console.error('Error updating pickup details:', error);
      throw error;
    }
  }

  /**
   * Update tracking details when shipment/waybill is created (new JSON CreateShipments API).
   * Optionally store full API response and product_group/product_type.
   */
  public async updateTrackingDetails(
    orderId: number,
    data: {
      tracking_number: string;
      waybill_label_url?: string | null;
      description_of_goods?: string;
      create_shipment_response?: string | null;
      product_group?: string | null;
      product_type?: string | null;
    }
  ): Promise<void> {
    try {
      const shipment = await this.getOrCreateShipment(orderId);
      await db.query(
        `UPDATE order_shipments SET 
          tracking_number = ?,
          waybill_label_url = ?,
          create_shipment_response = ?,
          shipment_created_at = NOW(),
          description_of_goods = ?,
          product_group = ?,
          product_type = ?,
          status = 'shipment_created',
          updated_at = NOW()
        WHERE id = ?`,
        [
          data.tracking_number,
          data.waybill_label_url ?? null,
          data.create_shipment_response ?? null,
          data.description_of_goods ?? null,
          data.product_group ?? null,
          data.product_type ?? null,
          shipment.id
        ]
      );
    } catch (error) {
      console.error('Error updating tracking details:', error);
      throw error;
    }
  }

  /**
   * Get all orders that have a shipment created (tracking number present), for admin Shipments page.
   * Includes order status and pickup_reference so UI can show pickup code and disable selection for shipped/scheduled.
   * Orders without a pickup (no pickup_reference) are returned first. Optional filters apply LIKE match.
   * shipped: 'not_shipped' (default) | 'shipped' | 'all'
   */
  public async getOrdersWithShipmentCreated(filters?: {
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
  }>> {
    const conditions: string[] = [
      "os.tracking_number IS NOT NULL AND TRIM(os.tracking_number) != ''"
    ];
    const params: (string | number)[] = [];

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
      conditions.push("(o.status IS NULL OR o.status != 'shipped')");
    } else if (shippedFilter === 'shipped') {
      conditions.push("o.status = 'shipped'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT o.id AS order_id, o.order_number, o.customer_email, o.status AS order_status,
       os.tracking_number, os.product_group, os.product_type, os.total_weight, os.id AS shipment_id,
       os.pickup_reference, os.status AS shipment_status
       FROM orders o
       INNER JOIN order_shipments os ON os.order_id = o.id
       ${whereClause}
       ORDER BY (CASE WHEN os.pickup_reference IS NULL OR TRIM(os.pickup_reference) = '' THEN 0 ELSE 1 END), o.created_at DESC`;

    const [rows] = await db.query<any>(sql, params);
    return rows || [];
  }

  /**
   * Update shipment status
   */
  public async updateShipmentStatus(orderId: number, status: string): Promise<void> {
    try {
      const shipment = await this.getShipmentByOrderId(orderId);
      if (shipment) {
        await db.query(
          'UPDATE order_shipments SET status = ?, updated_at = NOW() WHERE id = ?',
          [status, shipment.id]
        );
      }
    } catch (error) {
      console.error('Error updating shipment status:', error);
      throw error;
    }
  }
}
