export interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    image_url: string | null;
    thumb_url?: string | null;
    is_featured: boolean;
    order_index: number;
    meta_title: string | null;
    meta_description: string | null;
    meta_keywords: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    product_count?: number;
}
export declare class CategoryService {
    private static instance;
    private constructor();
    static getInstance(): CategoryService;
    getCategoryById(id: number): Promise<Category | null>;
    getCategoryBySlug(slug: string): Promise<Category | null>;
    getAllCategories(includeInactive?: boolean): Promise<Category[]>;
    getCategoryTree(includeInactive?: boolean): Promise<CategoryWithChildren[]>;
    getFeaturedCategories(limit?: number): Promise<Category[]>;
    getCategoryBreadcrumbs(categoryId: number): Promise<Category[]>;
    getCategoryDescendantIds(categoryId: number): Promise<number[]>;
    getCategoryPath(categoryId: number): Promise<string>;
}
declare const _default: CategoryService;
export default _default;
//# sourceMappingURL=categoryService.d.ts.map