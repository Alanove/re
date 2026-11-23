import { db } from '../../src/config/database';

export interface Customer {
  id: number;
  username: string;
  email: string;
  status: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: Date;
}

export class CustomerManagementService {
  private static instance: CustomerManagementService;

  private constructor() {}

  public static getInstance(): CustomerManagementService {
    if (!CustomerManagementService.instance) {
      CustomerManagementService.instance = new CustomerManagementService();
    }
    return CustomerManagementService.instance;
  }

  /**
   * Get all customers with order statistics
   */
  public async getAllCustomers(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      status?: string;
    }
  ): Promise<{
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let whereConditions: string[] = ["role = 'customer'"];
      let queryParams: any[] = [];

      if (filters?.search) {
        whereConditions.push('(u.email LIKE ? OR u.username LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters?.status) {
        whereConditions.push('u.status = ?');
        queryParams.push(filters.status);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total
      const [countRows] = await db.query<any>(
        `SELECT COUNT(*) as count FROM users u ${whereClause}`,
        queryParams
      );
      const total = ((countRows[0] as unknown) as { count: number })?.count || 0;

      // Get customers with order statistics
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      const [rows] = await db.query<any>(
        `SELECT 
          u.id,
          u.username,
          u.email,
          u.status,
          u.role,
          u.created_at,
          u.updated_at,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.customer_id
        ${whereClause}
        GROUP BY u.id, u.username, u.email, u.status, u.role, u.created_at, u.updated_at
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return {
        customers: rows.map((row: any) => ({
          ...row,
          total_orders: parseInt(row.total_orders) || 0,
          total_spent: parseFloat(row.total_spent) || 0,
          last_order_date: row.last_order_date || null
        })),
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting all customers:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID with full details
   */
  public async getCustomerById(id: number): Promise<Customer | null> {
    try {
      const [rows] = await db.query<any>(
        `SELECT 
          u.*,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.customer_id
        WHERE u.id = ? AND u.role = 'customer'
        GROUP BY u.id`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0] as any;
        return {
          ...row,
          total_orders: parseInt(row.total_orders) || 0,
          total_spent: parseFloat(row.total_spent) || 0,
          last_order_date: row.last_order_date || null
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting customer by ID:', error);
      throw error;
    }
  }

  /**
   * Get customer orders
   */
  public async getCustomerOrders(customerId: number): Promise<any[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT * FROM orders 
         WHERE customer_id = ? 
         ORDER BY created_at DESC`,
        [customerId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting customer orders:', error);
      throw error;
    }
  }

  /**
   * Get customer addresses
   */
  public async getCustomerAddresses(customerId: number): Promise<any[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT * FROM customer_addresses 
         WHERE customer_id = ? 
         ORDER BY is_default DESC, created_at DESC`,
        [customerId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting customer addresses:', error);
      throw error;
    }
  }

  /**
   * Update customer status
   */
  public async updateCustomerStatus(customerId: number, status: string): Promise<void> {
    try {
      await db.query(
        'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND role = ?',
        [status, customerId, 'customer']
      );
    } catch (error) {
      console.error('Error updating customer status:', error);
      throw error;
    }
  }
}

