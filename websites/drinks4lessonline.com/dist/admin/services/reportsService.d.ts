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
export declare class ReportsService {
    private static instance;
    private constructor();
    static getInstance(): ReportsService;
    getSalesReport(dateFrom?: string, dateTo?: string): Promise<SalesReport>;
    getBestSellingProducts(limit?: number, dateFrom?: string, dateTo?: string): Promise<ProductPerformance[]>;
    getCustomerAnalytics(dateFrom?: string, dateTo?: string): Promise<CustomerAnalytics>;
    private buildLowStockSearchFilter;
    getLowStockReport(threshold?: number, search?: string): Promise<LowStockItem[]>;
    getLowStockProducts(threshold?: number): Promise<any[]>;
    getDiscountUsageReport(dateFrom?: string, dateTo?: string): Promise<any[]>;
}
//# sourceMappingURL=reportsService.d.ts.map