import { db } from '../config/database';

export interface Discount {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: 'percentage' | 'fixed_amount';
  value: number;
  minimum_purchase: number | null;
  maximum_discount: number | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  used_count: number;
  start_date: Date | null;
  end_date: Date | null;
  is_active: boolean;
  applies_to: 'all' | 'products' | 'categories';
  product_ids: string | null; // JSON array
  category_ids: string | null; // JSON array
  first_time_customer_only: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DiscountValidationResult {
  valid: boolean;
  discount?: Discount;
  discountAmount?: number;
  error?: string;
}

export interface CartDiscountCalculation {
  discountAmount: number;
  finalTotal: number;
  discount: Discount;
}

export class DiscountService {
  private static instance: DiscountService;

  private constructor() {}

  public static getInstance(): DiscountService {
    if (!DiscountService.instance) {
      DiscountService.instance = new DiscountService();
    }
    return DiscountService.instance;
  }

  /**
   * Get discount by code
   */
  public async getDiscountByCode(code: string): Promise<Discount | null> {
    try {
      const [rows] = await db.query<Discount>(
        'SELECT * FROM discounts WHERE code = ?',
        [code.toUpperCase()]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting discount by code:', error);
      throw error;
    }
  }

  /**
   * Validate discount code
   */
  public async validateDiscountCode(
    code: string,
    subtotal: number,
    customerId?: number | null,
    productIds?: number[],
    categoryIds?: number[]
  ): Promise<DiscountValidationResult> {
    try {
      const discount = await this.getDiscountByCode(code);

      if (!discount) {
        return {
          valid: false,
          error: 'Invalid discount code'
        };
      }

      // Check if active
      if (!discount.is_active) {
        return {
          valid: false,
          error: 'Discount code is not active'
        };
      }

      // Check date range
      const now = new Date();
      if (discount.start_date && new Date(discount.start_date) > now) {
        return {
          valid: false,
          error: 'Discount code is not yet valid'
        };
      }

      if (discount.end_date && new Date(discount.end_date) < now) {
        return {
          valid: false,
          error: 'Discount code has expired'
        };
      }

      // Check usage limit
      if (discount.usage_limit !== null && discount.used_count >= discount.usage_limit) {
        return {
          valid: false,
          error: 'Discount code has reached its usage limit'
        };
      }

      // Check minimum purchase
      if (discount.minimum_purchase !== null && subtotal < discount.minimum_purchase) {
        return {
          valid: false,
          error: `Minimum purchase of ${discount.minimum_purchase} required`
        };
      }

      // Check per-customer limit
      if (customerId && discount.usage_limit_per_customer !== null) {
        const [usageRows] = await db.query<any>(
          'SELECT COUNT(*) as count FROM discount_usage WHERE discount_id = ? AND customer_id = ?',
          [discount.id, customerId]
        );
        if (usageRows[0]?.count >= discount.usage_limit_per_customer) {
          return {
            valid: false,
            error: 'You have already used this discount code'
          };
        }
      }

      // Check first-time customer only
      if (discount.first_time_customer_only && customerId) {
        const [orderRows] = await db.query<any>(
          'SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND payment_status = ?',
          [customerId, 'paid']
        );
        if (orderRows[0]?.count > 0) {
          return {
            valid: false,
            error: 'This discount is only available for first-time customers'
          };
        }
      }

      // Check applies_to restrictions
      if (discount.applies_to === 'products' && productIds) {
        const discountProductIds = discount.product_ids 
          ? JSON.parse(discount.product_ids) 
          : [];
        const hasMatchingProduct = productIds.some(id => discountProductIds.includes(id));
        if (!hasMatchingProduct) {
          return {
            valid: false,
            error: 'Discount code does not apply to items in your cart'
          };
        }
      }

      if (discount.applies_to === 'categories' && categoryIds) {
        const discountCategoryIds = discount.category_ids 
          ? JSON.parse(discount.category_ids) 
          : [];
        const hasMatchingCategory = categoryIds.some(id => discountCategoryIds.includes(id));
        if (!hasMatchingCategory) {
          return {
            valid: false,
            error: 'Discount code does not apply to items in your cart'
          };
        }
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
        if (discount.maximum_discount !== null && discountAmount > discount.maximum_discount) {
          discountAmount = discount.maximum_discount;
        }
      } else {
        discountAmount = discount.value;
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }
      }

      return {
        valid: true,
        discount,
        discountAmount
      };
    } catch (error) {
      console.error('Error validating discount code:', error);
      return {
        valid: false,
        error: 'Error validating discount code'
      };
    }
  }

  /**
   * Calculate discount for cart
   */
  public async calculateDiscount(
    code: string,
    subtotal: number,
    customerId?: number | null,
    productIds?: number[],
    categoryIds?: number[]
  ): Promise<CartDiscountCalculation | null> {
    const validation = await this.validateDiscountCode(
      code,
      subtotal,
      customerId,
      productIds,
      categoryIds
    );

    if (!validation.valid || !validation.discount || validation.discountAmount === undefined) {
      return null;
    }

    return {
      discountAmount: validation.discountAmount,
      finalTotal: subtotal - validation.discountAmount,
      discount: validation.discount
    };
  }

  /**
   * Record discount usage
   */
  public async recordDiscountUsage(
    discountId: number,
    orderId: number,
    customerId: number | null,
    discountAmount: number
  ): Promise<void> {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Insert usage record
      await connection.query(
        'INSERT INTO discount_usage (discount_id, order_id, customer_id, discount_amount) VALUES (?, ?, ?, ?)',
        [discountId, orderId, customerId, discountAmount]
      );

      // Increment used count
      await connection.query(
        'UPDATE discounts SET used_count = used_count + 1, updated_at = NOW() WHERE id = ?',
        [discountId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error recording discount usage:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all active discounts
   */
  public async getActiveDiscounts(): Promise<Discount[]> {
    try {
      const now = new Date();
      const [rows] = await db.query<Discount>(
        `SELECT * FROM discounts 
        WHERE is_active = TRUE 
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
        ORDER BY created_at DESC`,
        [now, now]
      );
      return rows;
    } catch (error) {
      console.error('Error getting active discounts:', error);
      throw error;
    }
  }

  /**
   * Get discount usage statistics
   */
  public async getDiscountUsageStats(discountId: number): Promise<{
    totalUsage: number;
    totalDiscountAmount: number;
    uniqueCustomers: number;
  }> {
    try {
      const [rows] = await db.query<any>(
        `SELECT 
          COUNT(*) as total_usage,
          COALESCE(SUM(discount_amount), 0) as total_discount_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM discount_usage
        WHERE discount_id = ?`,
        [discountId]
      );

      return {
        totalUsage: rows[0]?.total_usage || 0,
        totalDiscountAmount: parseFloat(rows[0]?.total_discount_amount?.toString() || '0'),
        uniqueCustomers: rows[0]?.unique_customers || 0
      };
    } catch (error) {
      console.error('Error getting discount usage stats:', error);
      return {
        totalUsage: 0,
        totalDiscountAmount: 0,
        uniqueCustomers: 0
      };
    }
  }
}

export default DiscountService.getInstance();

