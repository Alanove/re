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
    product_ids: string | null;
    category_ids: string | null;
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
export declare class DiscountService {
    private static instance;
    private constructor();
    static getInstance(): DiscountService;
    getDiscountByCode(code: string): Promise<Discount | null>;
    validateDiscountCode(code: string, subtotal: number, customerId?: number | null, productIds?: number[], categoryIds?: number[]): Promise<DiscountValidationResult>;
    calculateDiscount(code: string, subtotal: number, customerId?: number | null, productIds?: number[], categoryIds?: number[]): Promise<CartDiscountCalculation | null>;
    recordDiscountUsage(discountId: number, orderId: number, customerId: number | null, discountAmount: number): Promise<void>;
    getActiveDiscounts(): Promise<Discount[]>;
    getDiscountUsageStats(discountId: number): Promise<{
        totalUsage: number;
        totalDiscountAmount: number;
        uniqueCustomers: number;
    }>;
}
declare const _default: DiscountService;
export default _default;
//# sourceMappingURL=discountService.d.ts.map