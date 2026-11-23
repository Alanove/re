export type { VariantDisplayModel } from './variantDisplayService';
export declare function attachMultiPriceListingFieldsForProduct(product: any, variants: any[]): void;
export interface Product {
    id: number;
    name: string;
    slug: string;
    sku: string | null;
    short_description: string | null;
    description: string | null;
    price: number;
    compare_at_price: number | null;
    cost_price: number | null;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    stock_quantity: number;
    low_stock_threshold: number;
    track_inventory: boolean;
    is_featured: boolean;
    is_on_sale?: boolean;
    is_active: boolean;
    include_in_auto_ads: boolean;
    status: string;
    category_id: number | null;
    size_chart_id: number | null;
    meta_title: string | null;
    meta_description: string | null;
    meta_keywords: string | null;
    rating_average: number;
    rating_count: number;
    view_count: number;
    created_at: Date;
    updated_at: Date;
    has_variants?: boolean;
}
export interface ProductWithDetails extends Product {
    category?: {
        id: number;
        name: string;
        slug: string;
    } | null;
    brand?: {
        id: number;
        name: string;
        slug: string;
        logo_url: string | null;
    } | null;
    categories?: Array<{
        id: number;
        name: string;
        slug: string;
    }>;
    images?: Array<{
        id: number;
        image_url: string;
        alt_text: string | null;
        is_primary: boolean;
        order_index: number;
        attribute_value_id?: number | null;
    }>;
    variants?: Array<{
        id: number;
        sku: string | null;
        name: string;
        attributes: any;
        price: number | null;
        stock_quantity: number;
        is_default: boolean;
    }>;
}
export interface ProductFilters {
    category_id?: number;
    category_slug?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    is_featured?: boolean;
    is_active?: boolean;
    status?: string;
    in_stock?: boolean;
    on_sale?: boolean;
    sort_by?: 'name' | 'price' | 'created_at' | 'rating' | 'popularity';
    sort_order?: 'ASC' | 'DESC';
    page?: number;
    limit?: number;
}
export declare class ProductService {
    private static instance;
    private constructor();
    static getInstance(): ProductService;
    getProductById(id: number): Promise<Product | null>;
    getProductBySlug(slug: string): Promise<Product | null>;
    getProductWithDetails(id: number): Promise<ProductWithDetails | null>;
    getProducts(filters?: ProductFilters): Promise<{
        products: Product[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    attachColorOptionsForListing(products: any[]): Promise<void>;
    getProductPriceRange(filters?: ProductFilters): Promise<{
        min: number;
        max: number;
    }>;
    getFeaturedProducts(limit?: number): Promise<Product[]>;
    getRelatedProducts(productId: number, categoryId: number | null, limit?: number): Promise<Product[]>;
    incrementViewCount(productId: number): Promise<void>;
    isInStock(productId: number, variantId?: number, quantity?: number): Promise<boolean>;
    getProductPrice(productId: number, variantId?: number): Promise<number>;
}
declare const _default: ProductService;
export default _default;
//# sourceMappingURL=productService.d.ts.map