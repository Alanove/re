import { Discount } from '../../src/services/discountService';
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
export declare class DiscountManagementService {
    private static instance;
    private constructor();
    static getInstance(): DiscountManagementService;
    createDiscount(data: DiscountCreateData): Promise<Discount>;
    updateDiscount(id: number, data: Partial<DiscountCreateData>): Promise<Discount>;
    deleteDiscount(id: number): Promise<void>;
    getDiscountById(id: number): Promise<Discount | null>;
    getAllDiscounts(page?: number, limit?: number, filters?: {
        is_active?: boolean;
        search?: string;
    }): Promise<{
        discounts: Discount[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
declare const _default: DiscountManagementService;
export default _default;
//# sourceMappingURL=discountManagementService.d.ts.map