import { db } from '../../src/config/database';
import { Discount } from '../../src/services/discountService';
import * as mysql from 'mysql2/promise';

export interface DiscountCreateData {
  code: string;
  name: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  value: number;
  minimum_purchase?: number | null;
  maximum_discount?: number | null;
  usage_limit?: number | null;
  usage_limit_per_customer?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  applies_to?: 'all' | 'products' | 'categories';
  product_ids?: number[] | null;
  category_ids?: number[] | null;
  first_time_customer_only?: boolean;
}

export class DiscountManagementService {
  private static instance: DiscountManagementService;

  private constructor() {}

  public static getInstance(): DiscountManagementService {
    if (!DiscountManagementService.instance) {
      DiscountManagementService.instance = new DiscountManagementService();
    }
    return DiscountManagementService.instance;
  }

  /**
   * Create discount
   */
  public async createDiscount(data: DiscountCreateData): Promise<Discount> {
    try {
      const [result] = await db.query(
        `INSERT INTO discounts (
          code, name, description, type, value, minimum_purchase, maximum_discount,
          usage_limit, usage_limit_per_customer, start_date, end_date, is_active,
          applies_to, product_ids, category_ids, first_time_customer_only
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.code.toUpperCase(),
          data.name,
          data.description || null,
          data.type,
          data.value,
          data.minimum_purchase || null,
          data.maximum_discount || null,
          data.usage_limit || null,
          data.usage_limit_per_customer || null,
          data.start_date || null,
          data.end_date || null,
          data.is_active !== undefined ? data.is_active : true,
          data.applies_to || 'all',
          data.product_ids ? JSON.stringify(data.product_ids) : null,
          data.category_ids ? JSON.stringify(data.category_ids) : null,
          data.first_time_customer_only || false
        ]
      );

      const discountId = (result as unknown as mysql.ResultSetHeader).insertId;
      const discount = await this.getDiscountById(discountId);
      if (!discount) {
        throw new Error('Failed to retrieve created discount');
      }
      return discount;
    } catch (error) {
      console.error('Error creating discount:', error);
      throw error;
    }
  }

  /**
   * Update discount
   */
  public async updateDiscount(id: number, data: Partial<DiscountCreateData>): Promise<Discount> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'code') {
            updates.push('code = ?');
            values.push(String(value).toUpperCase());
          } else if (key === 'product_ids' || key === 'category_ids') {
            updates.push(`${key} = ?`);
            values.push(Array.isArray(value) ? JSON.stringify(value) : value);
          } else {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }
      });

      if (updates.length === 0) {
        const discount = await this.getDiscountById(id);
        if (!discount) {
          throw new Error('Discount not found');
        }
        return discount;
      }

      values.push(id);
      await db.query(
        `UPDATE discounts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      const discount = await this.getDiscountById(id);
      if (!discount) {
        throw new Error('Discount not found');
      }
      return discount;
    } catch (error) {
      console.error('Error updating discount:', error);
      throw error;
    }
  }

  /**
   * Delete discount
   */
  public async deleteDiscount(id: number): Promise<void> {
    try {
      await db.query('DELETE FROM discounts WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting discount:', error);
      throw error;
    }
  }

  /**
   * Get discount by ID
   */
  public async getDiscountById(id: number): Promise<Discount | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM discounts WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? ((rows[0] as unknown) as Discount) : null;
    } catch (error) {
      console.error('Error getting discount by ID:', error);
      throw error;
    }
  }

  /**
   * Get all discounts
   */
  public async getAllDiscounts(
    page: number = 1,
    limit: number = 50,
    filters?: {
      is_active?: boolean;
      search?: string;
    }
  ): Promise<{
    discounts: Discount[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      if (filters?.is_active !== undefined) {
        whereConditions.push('is_active = ?');
        queryParams.push(filters.is_active);
      }

      if (filters?.search) {
        whereConditions.push('(code LIKE ? OR name LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const [countRows] = await db.query<any>(
        `SELECT COUNT(*) as count FROM discounts ${whereClause}`,
        queryParams
      );
      const total = (countRows[0] as { count: number })?.count || 0;

      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      const [rows] = await db.query<any>(
        `SELECT * FROM discounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      return {
        discounts: (rows as unknown) as Discount[],
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting all discounts:', error);
      throw error;
    }
  }
}

export default DiscountManagementService.getInstance();

