import { db } from '../config/database';

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
}

export interface OrderWithItems extends Order {
  items?: OrderItem[];
}

export interface CreateOrderData {
  customer_id?: number | null | undefined;
  customer_email: string;
  customer_phone?: string | undefined;
  shipping_address: any; // JSON object
  billing_address?: any | undefined; // JSON object
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

export class OrderService {
  private static instance: OrderService;

  private constructor() {}

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `${prefix}-${timestamp}-${random}`;

    // Check if exists
    const [rows] = await db.query<Order>(
      'SELECT id FROM orders WHERE order_number = ?',
      [orderNumber]
    );

    if (rows.length > 0) {
      // Retry with new random
      return this.generateOrderNumber();
    }

    return orderNumber;
  }

  /**
   * Create new order
   */
  public async createOrder(orderData: CreateOrderData): Promise<Order> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Insert order
      const [result] = await connection.query<any>(
        `INSERT INTO orders (
          order_number, customer_id, customer_email, customer_phone,
          status, subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
          currency, payment_method, payment_status, shipping_method,
          shipping_address, billing_address, discount_code, notes
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          orderData.customer_id || null,
          orderData.customer_email,
          orderData.customer_phone || null,
          orderData.subtotal,
          orderData.tax_amount,
          orderData.shipping_amount,
          orderData.discount_amount,
          orderData.total_amount,
          orderData.currency || 'USD',
          orderData.payment_method,
          orderData.shipping_method || null,
          JSON.stringify(orderData.shipping_address),
          orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
          orderData.discount_code || null,
          orderData.notes || null
        ]
      );

      const orderId = (result as any).insertId;

      // Insert order items
      for (const item of orderData.items) {
        // Get product details for snapshot
        const [productRows] = await connection.query<any>(
          'SELECT name, sku FROM products WHERE id = ?',
          [item.product_id]
        );
        const product = productRows[0];

        let variantName = null;
        if (item.variant_id) {
          const [variantRows] = await connection.query<any>(
            'SELECT name FROM product_variants WHERE id = ?',
            [item.variant_id]
          );
          if (variantRows.length > 0) {
            variantName = variantRows[0].name;
          }
        }

        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, variant_name, sku,
            quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.variant_id || null,
            product.name,
            variantName,
            product.sku,
            item.quantity,
            item.unit_price,
            item.unit_price * item.quantity
          ]
        );

        // Update inventory if tracking is enabled
        if (item.variant_id) {
          await connection.query(
            `UPDATE product_variants 
            SET stock_quantity = stock_quantity - ? 
            WHERE id = ? AND track_inventory = TRUE`,
            [item.quantity, item.variant_id]
          );
        } else {
          await connection.query(
            `UPDATE products 
            SET stock_quantity = stock_quantity - ? 
            WHERE id = ? AND track_inventory = TRUE`,
            [item.quantity, item.product_id]
          );
        }
      }

      // Add status history
      await connection.query(
        'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
        [orderId, 'pending']
      );

      await connection.commit();

      // Get and return created order
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error('Failed to retrieve created order');
      }

      return order;
    } catch (error) {
      await connection.rollback();
      console.error('Error creating order:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get order by ID
   */
  public async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const [rows] = await db.query<Order>(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      throw error;
    }
  }

  /**
   * Get order by order number
   */
  public async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const [rows] = await db.query<Order>(
        'SELECT * FROM orders WHERE order_number = ?',
        [orderNumber]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting order by number:', error);
      throw error;
    }
  }

  /**
   * Get order with items
   */
  public async getOrderWithItems(orderId: number): Promise<OrderWithItems | null> {
    try {
      const order = await this.getOrderById(orderId);
      if (!order) return null;

      const items = await this.getOrderItems(orderId);

      return {
        ...order,
        items,
        shipping_address: typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address) 
          : order.shipping_address,
        billing_address: order.billing_address && typeof order.billing_address === 'string'
          ? JSON.parse(order.billing_address)
          : order.billing_address
      };
    } catch (error) {
      console.error('Error getting order with items:', error);
      throw error;
    }
  }

  /**
   * Get order items
   */
  public async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      const [rows] = await db.query<OrderItem>(
        'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
        [orderId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting order items:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  public async updateOrderStatus(
    orderId: number,
    status: string,
    userId?: number,
    notes?: string
  ): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update order
      await connection.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
      );

      // Add status history
      await connection.query(
        'INSERT INTO order_status_history (order_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
        [orderId, status, notes || null, userId || null]
      );

      // Update timestamps for specific statuses
      if (status === 'shipped') {
        await connection.query(
          'UPDATE orders SET shipped_at = NOW() WHERE id = ?',
          [orderId]
        );
      } else if (status === 'delivered') {
        await connection.query(
          'UPDATE orders SET delivered_at = NOW() WHERE id = ?',
          [orderId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error updating order status:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update payment status
   */
  public async updatePaymentStatus(orderId: number, paymentStatus: string): Promise<void> {
    try {
      await db.query(
        'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
        [paymentStatus, orderId]
      );
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Append a note to the order (e.g. payment error code and description).
   */
  public async addOrderNote(orderId: number, note: string): Promise<void> {
    try {
      await db.query(
        'UPDATE orders SET notes = CONCAT(COALESCE(notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?',
        [note, orderId]
      );
    } catch (error) {
      console.error('Error adding order note:', error);
      throw error;
    }
  }

  /**
   * Attach a single guest order to a customer by order id. Only updates if order.customer_id is null.
   * Used when a user registers from the order-success page with an order number in the URL.
   */
  public async attachOrderToCustomer(orderId: number, customerId: number): Promise<boolean> {
    try {
      const [result] = await db.query<any>(
        'UPDATE orders SET customer_id = ?, updated_at = NOW() WHERE id = ? AND customer_id IS NULL',
        [customerId, orderId]
      );
      return ((result as any).affectedRows ?? 0) > 0;
    } catch (error) {
      console.error('Error attaching order to customer:', error);
      throw error;
    }
  }

  /**
   * Attach guest orders (customer_id IS NULL) to a customer by matching customer_email.
   * Used when a guest registers so their past orders appear under "My Orders".
   */
  public async attachGuestOrdersToCustomer(customerId: number, email: string): Promise<number> {
    if (!email || typeof email !== 'string') return 0;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return 0;
    try {
      const [result] = await db.query<any>(
        `UPDATE orders SET customer_id = ?, updated_at = NOW() 
         WHERE customer_id IS NULL AND LOWER(TRIM(customer_email)) = ?`,
        [customerId, normalizedEmail]
      );
      return (result as any).affectedRows ?? 0;
    } catch (error) {
      console.error('Error attaching guest orders to customer:', error);
      throw error;
    }
  }

  /**
   * Get customer orders
   */
  public async getCustomerOrders(customerId: number, limit: number = 50): Promise<Order[]> {
    try {
      const [rows] = await db.query<Order>(
        `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count 
         FROM orders o 
         WHERE o.customer_id = ? 
         ORDER BY o.created_at DESC 
         LIMIT ?`,
        [customerId, limit]
      );
      return rows as any as Order[];
    } catch (error) {
      console.error('Error getting customer orders:', error);
      throw error;
    }
  }

  /**
   * Get order status history
   */
  public async getOrderStatusHistory(orderId: number): Promise<Array<{
    id: number;
    status: string;
    notes: string | null;
    created_by: number | null;
    created_at: Date;
  }>> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
        [orderId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting order status history:', error);
      throw error;
    }
  }
}

export default OrderService.getInstance();

