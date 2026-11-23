import { Category } from '../../src/services/categoryService';
export interface CategoryCreateData {
    name: string;
    slug: string;
    description?: string | null;
    parent_id?: number | null;
    image_url?: string | null;
    thumb_url?: string | null;
    is_featured?: boolean;
    order_index?: number;
    meta_title?: string | null;
    meta_description?: string | null;
    meta_keywords?: string | null;
    is_active?: boolean;
}
export declare class CategoryManagementService {
    private static instance;
    private constructor();
    static getInstance(): CategoryManagementService;
    createCategory(data: CategoryCreateData): Promise<Category>;
    updateCategory(id: number, data: Partial<CategoryCreateData>): Promise<Category>;
    deleteCategory(id: number): Promise<void>;
    getCategoryById(id: number): Promise<Category | null>;
    getAllCategories(includeInactive?: boolean): Promise<Category[]>;
    updateCategoryOrder(updates: Array<{
        id: number;
        order_index: number;
    }>): Promise<void>;
}
declare const _default: CategoryManagementService;
export default _default;
//# sourceMappingURL=categoryManagementService.d.ts.map