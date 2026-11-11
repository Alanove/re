import { db } from '../../src/config/database';

export interface SalesReport {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
}

export interface ProductPerformance {
  product_id: number;
  product_name: string;
  total_sold: number;
  total_revenue: number;
  order_count: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageOrderValue: number;
  topCustomers: Array<{
    customer_id: number;
    email: string;
    total_orders: number;
    total_spent: number;
  }>;
}

export interface LowStockItem {
  item_type: 'product' | 'variant';
  product_id: number;
  variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  product_number: number;
  sku: string | null;
  slug: string;
  stock_quantity: number;
  category_name: string | null;
}

export class ReportsService {
  private static instance: ReportsService;

  private constructor() {}

  public static getInstance(): ReportsService {
    if (!ReportsService.instance) {
      ReportsService.instance = new ReportsService();
    }
    return ReportsService.instance;
  }

  /**
   * Get sales report
   */
  public async getSalesReport(
    dateFrom?: string,
    dateTo?: string
  ): Promise<SalesReport> {
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

      // Get total orders and revenue
      const [summaryRows] = await db.query<any>(
        `SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_order_value
        FROM orders ${dateFilter}`,
        params
      );

      const summary = summaryRows[0];

      // Get orders by status
      const [statusRows] = await db.query<any>(
        `SELECT status, COUNT(*) as count 
         FROM orders ${dateFilter}
         GROUP BY status`,
        params
      );

      const ordersByStatus: Record<string, number> = {};
      statusRows.forEach((row: any) => {
        ordersByStatus[row.status] = parseInt(row.count);
      });

      return {
        period: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All time',
        totalOrders: parseInt(summary.total_orders) || 0,
        totalRevenue: parseFloat(summary.total_revenue) || 0,
        averageOrderValue: parseFloat(summary.average_order_value) || 0,
        ordersByStatus
      };
    } catch (error) {
      console.error('Error getting sales report:', error);
      throw error;
    }
  }

  /**
   * Get best selling products
   */
  public async getBestSellingProducts(
    limit: number = 10,
    dateFrom?: string,
    dateTo?: string
  ): Promise<ProductPerformance[]> {
    try {
      let dateFilter = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(o.created_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        dateFilter = 'AND DATE(o.created_at) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        dateFilter = 'AND DATE(o.created_at) <= ?';
        params.push(dateTo);
      }

      const [rows] = await db.query<any>(
        `SELECT 
          oi.product_id,
          oi.product_name,
          SUM(oi.quantity) as total_sold,
          SUM(oi.total_price) as total_revenue,
          COUNT(DISTINCT oi.order_id) as order_count
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled' ${dateFilter}
        GROUP BY oi.product_id, oi.product_name
        ORDER BY total_sold DESC
        LIMIT ?`,
        [...params, limit]
      );

      return rows.map((row: any) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        total_sold: parseInt(row.total_sold) || 0,
        total_revenue: parseFloat(row.total_revenue) || 0,
        order_count: parseInt(row.order_count) || 0
      }));
    } catch (error) {
      console.error('Error getting best selling products:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  public async getCustomerAnalytics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<CustomerAnalytics> {
    try {
      // Date filter: use AND + qualified column so it can be appended to existing WHERE clauses.
      // Build base predicate (column name is replaced per-query to avoid ambiguous created_at).
      let dateFilter = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        dateFilter = 'AND DATE({{col}}) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        dateFilter = 'AND DATE({{col}}) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        dateFilter = 'AND DATE({{col}}) <= ?';
        params.push(dateTo);
      }

      const df = (col: string) => (dateFilter ? dateFilter.replace(/\{\{col\}\}/g, col) : '');

      // Get total customers (users table: filter by user signup date)
      const [totalRows] = await db.query<any>(
        `SELECT COUNT(*) as total FROM users WHERE role = 'customer' ${df('users.created_at')}`,
        params
      );

      // Get new customers (first order in period) using GROUP BY to avoid correlated subquery
      // Build separate params since the outer column is an alias (first_order), not a raw column
      let newCustomerDateFilter = '';
      const newCustomerParams: any[] = [];
      if (dateFrom && dateTo) {
        newCustomerDateFilter = 'AND DATE(first_order) BETWEEN ? AND ?';
        newCustomerParams.push(dateFrom, dateTo);
      } else if (dateFrom) {
        newCustomerDateFilter = 'AND DATE(first_order) >= ?';
        newCustomerParams.push(dateFrom);
      } else if (dateTo) {
        newCustomerDateFilter = 'AND DATE(first_order) <= ?';
        newCustomerParams.push(dateTo);
      }
      const [newCustomerRows] = await db.query<any>(
        `SELECT COUNT(*) as new_customers
         FROM (
           SELECT customer_id, MIN(created_at) AS first_order
           FROM orders
           WHERE customer_id IS NOT NULL
           GROUP BY customer_id
         ) first_orders
         WHERE 1=1 ${newCustomerDateFilter}`,
        newCustomerParams
      );

      // Get returning customers – filter by order date
      const [returningRows] = await db.query<any>(
        `SELECT COUNT(DISTINCT customer_id) as returning_customers
         FROM orders
         WHERE customer_id IS NOT NULL
         AND customer_id IN (
           SELECT customer_id
           FROM orders
           GROUP BY customer_id
           HAVING COUNT(*) > 1
         )
         ${df('orders.created_at')}`,
        params
      );

      // Get average order value – filter by order date
      const [avgRows] = await db.query<any>(
        `SELECT COALESCE(AVG(total_amount), 0) as avg_order_value
         FROM orders
         WHERE customer_id IS NOT NULL ${df('orders.created_at')}`,
        params
      );

      // Get top customers – filter by order date
      const [topCustomerRows] = await db.query<any>(
        `SELECT 
          o.customer_id,
          u.email,
          COUNT(DISTINCT o.id) as total_orders,
          SUM(o.total_amount) as total_spent
        FROM orders o
        INNER JOIN users u ON o.customer_id = u.id
        WHERE o.customer_id IS NOT NULL ${df('o.created_at')}
        GROUP BY o.customer_id, u.email
        ORDER BY total_spent DESC
        LIMIT 10`,
        params
      );

      return {
        totalCustomers: parseInt(totalRows[0]?.total) || 0,
        newCustomers: parseInt(newCustomerRows[0]?.new_customers) || 0,
        returningCustomers: parseInt(returningRows[0]?.returning_customers) || 0,
        averageOrderValue: parseFloat(avgRows[0]?.avg_order_value) || 0,
        topCustomers: topCustomerRows.map((row: any) => ({
          customer_id: row.customer_id,
          email: row.email,
          total_orders: parseInt(row.total_orders) || 0,
          total_spent: parseFloat(row.total_spent) || 0
        }))
      };
    } catch (error) {
      console.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Build search filter for low stock report (products and variants).
   */
  private buildLowStockSearchFilter(
    search: string | undefined,
    productAlias: string,
    variantAlias: string | null
  ): { clause: string; params: any[] } {
    const trimmed = search?.trim();
    if (!trimmed) {
      return { clause: '', params: [] };
    }

    const like = `%${trimmed}%`;
    const parts: string[] = [
      `${productAlias}.name LIKE ?`,
      `${productAlias}.sku LIKE ?`,
      `${productAlias}.slug LIKE ?`
    ];
    const params: any[] = [like, like, like];

    if (/^\d+$/.test(trimmed)) {
      parts.push(`${productAlias}.id = ?`);
      params.push(parseInt(trimmed, 10));
    }

    if (variantAlias) {
      parts.push(`${variantAlias}.name LIKE ?`, `${variantAlias}.sku LIKE ?`);
      params.push(like, like);
      if (/^\d+$/.test(trimmed)) {
        parts.push(`${variantAlias}.id = ?`);
        params.push(parseInt(trimmed, 10));
      }
    }

    return { clause: `AND (${parts.join(' OR ')})`, params };
  }

  /**
   * Low stock report: products and variants below a stock threshold.
   */
  public async getLowStockReport(
    threshold: number = 100,
    search?: string
  ): Promise<LowStockItem[]> {
    try {
      const stockThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 100;
      const productSearch = this.buildLowStockSearchFilter(search, 'p', null);
      const variantSearch = this.buildLowStockSearchFilter(search, 'p', 'pv');

      const categorySubquery = `(SELECT GROUP_CONCAT(pc.name SEPARATOR ', ')
         FROM product_category_relations pcr
         JOIN product_categories pc ON pcr.category_id = pc.id
         WHERE pcr.product_id = p.id)`;

      const [rows] = await db.query<any>(
        `SELECT * FROM (
          SELECT
            'product' AS item_type,
            p.id AS product_id,
            NULL AS variant_id,
            p.name AS product_name,
            NULL AS variant_name,
            p.id AS product_number,
            p.sku,
            p.slug,
            p.stock_quantity,
            ${categorySubquery} AS category_name
          FROM products p
          WHERE p.track_inventory = TRUE
            AND p.is_active = TRUE
            AND p.stock_quantity < ?
            ${productSearch.clause}

          UNION ALL

          SELECT
            'variant' AS item_type,
            p.id AS product_id,
            pv.id AS variant_id,
            p.name AS product_name,
            pv.name AS variant_name,
            p.id AS product_number,
            COALESCE(pv.sku, p.sku) AS sku,
            p.slug,
            pv.stock_quantity,
            ${categorySubquery} AS category_name
          FROM product_variants pv
          INNER JOIN products p ON pv.product_id = p.id
          WHERE pv.track_inventory = TRUE
            AND pv.is_active = TRUE
            AND p.is_active = TRUE
            AND pv.stock_quantity < ?
            ${variantSearch.clause}
        ) low_stock_items
        ORDER BY stock_quantity ASC, product_name ASC, variant_name ASC`,
        [
          stockThreshold,
          ...productSearch.params,
          stockThreshold,
          ...variantSearch.params
        ]
      );

      return rows.map((row: any) => ({
        item_type: row.item_type,
        product_id: row.product_id,
        variant_id: row.variant_id ?? null,
        product_name: row.product_name,
        variant_name: row.variant_name ?? null,
        product_number: row.product_number,
        sku: row.sku ?? null,
        slug: row.slug,
        stock_quantity: parseInt(row.stock_quantity, 10) || 0,
        category_name: row.category_name ?? null
      }));
    } catch (error) {
      console.error('Error getting low stock report:', error);
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  public async getLowStockProducts(threshold?: number): Promise<any[]> {
    try {
      const lowStockThreshold = threshold || 5;

      const [rows] = await db.query<any>(
        `SELECT 
          p.id,
          p.name,
          p.sku,
          p.stock_quantity,
          p.low_stock_threshold,
          pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.track_inventory = TRUE
        AND p.stock_quantity <= COALESCE(p.low_stock_threshold, ?)
        AND p.is_active = TRUE
        ORDER BY p.stock_quantity ASC`,
        [lowStockThreshold]
      );

      return rows;
    } catch (error) {
      console.error('Error getting low stock products:', error);
      throw error;
    }
  }

  /**
   * Get discount usage report
   */
  public async getDiscountUsageReport(
    dateFrom?: string,
    dateTo?: string
  ): Promise<any[]> {
    try {
      let dateFilter = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        dateFilter = 'AND DATE(du.used_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        dateFilter = 'AND DATE(du.used_at) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        dateFilter = 'AND DATE(du.used_at) <= ?';
        params.push(dateTo);
      }

      const [rows] = await db.query<any>(
        `SELECT 
          d.id,
          d.code,
          d.name,
          d.type,
          d.value,
          COUNT(du.id) as usage_count,
          SUM(du.discount_amount) as total_discount_amount
        FROM discounts d
        LEFT JOIN discount_usage du ON d.id = du.discount_id ${dateFilter}
        GROUP BY d.id, d.code, d.name, d.type, d.value
        ORDER BY usage_count DESC`,
        params
      );

      return rows.map((row: any) => ({
        ...row,
        usage_count: parseInt(row.usage_count) || 0,
        total_discount_amount: parseFloat(row.total_discount_amount) || 0
      }));
    } catch (error) {
      console.error('Error getting discount usage report:', error);
      throw error;
    }
  }
}

