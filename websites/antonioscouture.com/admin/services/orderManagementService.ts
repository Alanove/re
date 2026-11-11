import { db } from '../../src/config/database';
import { Order, OrderWithItems, OrderItem } from '../../src/services/orderService';

export class OrderManagementService {
  private static instance: OrderManagementService;

  private constructor() {}

  public static getInstance(): OrderManagementService {
    if (!OrderManagementService.instance) {
      OrderManagementService.instance = new OrderManagementService();
    }
    return OrderManagementService.instance;
  }

  /**
   * Get all orders with filters
   */
  public async getAllOrders(
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: string;
      payment_status?: string;
      payment_type?: string;
      customer_id?: number;
      date_from?: string;
      date_to?: string;
      search?: string;
    }
  ): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      if (filters?.status) {
        whereConditions.push('status = ?');
        queryParams.push(filters.status);
      }

      if (filters?.payment_status) {
        whereConditions.push('payment_status = ?');
        queryParams.push(filters.payment_status);
      }

      if (filters?.payment_type) {
        whereConditions.push('LOWER(payment_method) = ?');
        queryParams.push(filters.payment_type.toLowerCase());
      }

      if (filters?.customer_id) {
        whereConditions.push('customer_id = ?');
        queryParams.push(filters.customer_id);
      }

      if (filters?.date_from) {
        whereConditions.push('DATE(created_at) >= ?');
        queryParams.push(filters.date_from);
      }

      if (filters?.date_to) {
        whereConditions.push('DATE(created_at) <= ?');
        queryParams.push(filters.date_to);
      }

      if (filters?.search) {
        whereConditions.push('(order_number LIKE ? OR customer_email LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total
      const [countRows] = await db.query<any>(
        `SELECT COUNT(*) as count FROM orders ${whereClause}`,
        queryParams
      );
      const total = ((countRows[0] as unknown) as { count: number })?.count || 0;

      // Get orders
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      const [rows] = await db.query<any>(
        `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count FROM orders o ${whereClause.replace(/\borders\b/g, 'o')} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return {
        orders: rows as Order[],
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw error;
    }
  }

  /**
   * Get order with items
   */
  public async getOrderWithItems(orderId: number): Promise<OrderWithItems | null> {
    try {
      const [orderRows] = await db.query<any>(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderRows.length === 0) {
        return null;
      }

      const order = ((orderRows[0] as unknown) as Order);
      const [itemRows] = await db.query<OrderItem[]>(
        'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
        [orderId]
      );

      return {
        ...order,
        items: ((itemRows as unknown) as OrderItem[]),
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

      await connection.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
      );

      await connection.query(
        'INSERT INTO order_status_history (order_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
        [orderId, status, notes || null, userId || null]
      );

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
   * Add order note
   */
  public async addOrderNote(orderId: number, note: string, isInternal: boolean = false): Promise<void> {
    try {
      if (isInternal) {
        await db.query(
          'UPDATE orders SET internal_notes = CONCAT(COALESCE(internal_notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?',
          [note, orderId]
        );
      } else {
        await db.query(
          'UPDATE orders SET notes = CONCAT(COALESCE(notes, ""), "\n", ?, " - ", NOW()) WHERE id = ?',
          [note, orderId]
        );
      }
    } catch (error) {
      console.error('Error adding order note:', error);
      throw error;
    }
  }

  /**
   * Update order notes
   */
  public async updateOrderNotes(orderId: number, internalNotes: string): Promise<void> {
    try {
      await db.query(
        'UPDATE orders SET internal_notes = ?, updated_at = NOW() WHERE id = ?',
        [internalNotes || null, orderId]
      );
    } catch (error) {
      console.error('Error updating order notes:', error);
      throw error;
    }
  }

  /**
   * Update order tracking number and optional waybill label URL
   */
  public async updateOrderTracking(
    orderId: number,
    trackingNumber: string,
    waybillLabelUrl?: string | null
  ): Promise<void> {
    try {
      await db.query(
        'UPDATE orders SET tracking_number = ?, waybill_label_url = ?, updated_at = NOW() WHERE id = ?',
        [trackingNumber, waybillLabelUrl ?? null, orderId]
      );
    } catch (error) {
      console.error('Error updating order tracking:', error);
      throw error;
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
   * Check if order is eligible for cart edit (cash on delivery only).
   * Handles common stored values: code, display name, "COD", "Pay on Delivery", etc.
   */
  public isCashOnDelivery(order: Order): boolean {
    const raw = order.payment_method;
    if (raw == null || raw === '') return false;
    const pm = String(raw).trim().toLowerCase();
    if (pm === 'cash_on_delivery' || pm === 'cod') return true;
    if (pm.includes('cash') || pm.includes('cod')) return true;
    if (pm.includes('on delivery')) return true; // "Pay on Delivery", "Cash on Delivery"
    return false;
  }

  /**
   * Get products with variants for admin order edit-cart (add product dropdown)
   */
  public async getProductsWithVariantsForOrder(search?: string): Promise<Array<{
    id: number;
    name: string;
    sku: string | null;
    variants: Array<{ id: number | null; name: string; sku: string | null; price: number }>;
  }>> {
    try {
      let whereClause = "WHERE p.is_active = TRUE AND p.status = 'published'";
      const params: any[] = [];
      if (search && search.trim()) {
        whereClause += " AND (p.name LIKE ? OR p.sku LIKE ?)";
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }
      const [rows] = await db.query<any>(
        `SELECT p.id, p.name, p.sku, p.price
         FROM products p ${whereClause}
         ORDER BY p.name ASC
         LIMIT 100`,
        params
      );
      const result: Array<{ id: number; name: string; sku: string | null; variants: Array<{ id: number | null; name: string; sku: string | null; price: number }> }> = [];
      for (const p of rows) {
        const [varRows] = await db.query<any>(
          'SELECT id, name, sku, price FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY is_default DESC, id ASC',
          [p.id]
        );
        let variants: Array<{ id: number | null; name: string; sku: string | null; price: number }>;
        if (varRows.length > 0) {
          variants = varRows.map((v: any) => ({
            id: v.id,
            name: v.name || '',
            sku: v.sku || null,
            price: parseFloat(v.price) || 0
          }));
        } else {
          variants = [{ id: null, name: 'Default', sku: p.sku, price: parseFloat(p.price) || 0 }];
        }
        result.push({
          id: p.id,
          name: p.name,
          sku: p.sku || null,
          variants
        });
      }
      return result;
    } catch (error) {
      console.error('Error getting products for order edit:', error);
      throw error;
    }
  }

  /**
   * Update order cart (items and optional shipping). Only allowed for cash on delivery orders.
   * Item prices are cart-only; they do not change the original product/variant price.
   */
  public async updateOrderCart(
    orderId: number,
    items: Array<{ id?: number; product_id: number; variant_id: number | null; quantity: number; unit_price: number }>,
    shippingAmount?: number
  ): Promise<void> {
    const connection = await db.getConnection();
    try {
      const [orderRows] = await connection.query<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length === 0) {
        throw new Error('Order not found');
      }
      const order = orderRows[0];
      const isCOD = this.isCashOnDelivery(order as Order);
      if (!isCOD) {
        throw new Error('Cart can only be edited for cash on delivery orders');
      }

      await connection.beginTransaction();

      const [currentRows] = await connection.query<any>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      const currentItems = currentRows as (OrderItem & { product_id: number; variant_id: number | null })[];
      const currentById = new Map(currentItems.map(i => [i.id, i]));
      const incomingIds = new Set((items.filter(i => i.id != null).map(i => i.id!) as number[]));

      // Restore inventory for items that are being removed or reduced
      for (const cur of currentItems) {
        const incoming = items.find(i => i.id === cur.id);
        const newQty = incoming ? incoming.quantity : 0;
        const delta = cur.quantity - newQty;
        if (delta <= 0) continue;
        const qtyToRestore = delta;
        if (cur.variant_id) {
          await connection.query(
            `UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`,
            [qtyToRestore, cur.variant_id]
          );
        } else {
          await connection.query(
            `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`,
            [qtyToRestore, cur.product_id]
          );
        }
      }

      // Delete items no longer in the list
      for (const cur of currentItems) {
        if (!incomingIds.has(cur.id)) {
          if (cur.quantity > 0) {
            if (cur.variant_id) {
              await connection.query(
                `UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`,
                [cur.quantity, cur.variant_id]
              );
            } else {
              await connection.query(
                `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_inventory = TRUE`,
                [cur.quantity, cur.product_id]
              );
            }
          }
          await connection.query('DELETE FROM order_items WHERE id = ?', [cur.id]);
        }
      }

      let newSubtotal = 0;

      for (const it of items) {
        const total_price = it.unit_price * it.quantity;
        newSubtotal += total_price;

        if (it.id != null && incomingIds.has(it.id)) {
          await connection.query(
            'UPDATE order_items SET quantity = ?, unit_price = ?, total_price = ? WHERE id = ?',
            [it.quantity, it.unit_price, total_price, it.id]
          );
          const cur = currentById.get(it.id);
          if (cur && it.quantity > cur.quantity) {
            const delta = it.quantity - cur.quantity;
            if (cur.variant_id) {
              await connection.query(
                `UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`,
                [delta, cur.variant_id]
              );
            } else {
              await connection.query(
                `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`,
                [delta, cur.product_id]
              );
            }
          }
        } else if (it.id == null) {
          const [productRows] = await connection.query<any>('SELECT name, sku FROM products WHERE id = ?', [it.product_id]);
          const product = productRows[0];
          let variantName: string | null = null;
          let sku = product?.sku || null;
          if (it.variant_id) {
            const [vRows] = await connection.query<any>('SELECT name, sku FROM product_variants WHERE id = ?', [it.variant_id]);
            if (vRows[0]) {
              variantName = vRows[0].name;
              sku = vRows[0].sku || sku;
            }
          }
          await connection.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, total_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, it.product_id, it.variant_id, product?.name || '', variantName, sku, it.quantity, it.unit_price, total_price]
          );
          if (it.quantity > 0) {
            if (it.variant_id) {
              await connection.query(
                `UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`,
                [it.quantity, it.variant_id]
              );
            } else {
              await connection.query(
                `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND track_inventory = TRUE`,
                [it.quantity, it.product_id]
              );
            }
          }
        }
      }

      const discountAmount = parseFloat(order.discount_amount) || 0;
      const taxAmount = parseFloat(order.tax_amount) || 0;
      const newShipping = shippingAmount != null && !isNaN(Number(shippingAmount)) ? Number(shippingAmount) : parseFloat(order.shipping_amount) || 0;
      const newTotal = newSubtotal - discountAmount + newShipping + taxAmount;

      await connection.query(
        'UPDATE orders SET subtotal = ?, shipping_amount = ?, total_amount = ?, updated_at = NOW() WHERE id = ?',
        [newSubtotal, newShipping, newTotal, orderId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error updating order cart:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get order statistics
   */
  public async getOrderStatistics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
  }> {
    try {
      let dateFilter = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        dateFilter = 'WHERE DATE(created_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        dateFilter = 'WHERE DATE(created_at) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        dateFilter = 'WHERE DATE(created_at) <= ?';
        params.push(dateTo);
      }

      const [statsRows] = await db.query<any>(
        `SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders ${dateFilter}`,
        params
      );

      const [statusRows] = await db.query<any>(
        `SELECT status, COUNT(*) as count FROM orders ${dateFilter} GROUP BY status`,
        params
      );

      const ordersByStatus: Record<string, number> = {};
      statusRows.forEach((row: any) => {
        ordersByStatus[row.status] = row.count;
      });

      const statsRow = statsRows[0] as any;
      return {
        totalOrders: statsRow?.total_orders || 0,
        totalRevenue: parseFloat(statsRow?.total_revenue?.toString() || '0'),
        averageOrderValue: parseFloat(statsRow?.avg_order_value?.toString() || '0'),
        ordersByStatus
      };
    } catch (error) {
      console.error('Error getting order statistics:', error);
      return {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersByStatus: {}
      };
    }
  }
}

export default OrderManagementService.getInstance();

