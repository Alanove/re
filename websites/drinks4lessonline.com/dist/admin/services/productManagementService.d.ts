import { Product } from '../../src/services/productService';
export interface ProductCreateData {
    name: string;
    slug: string;
    sku?: string | undefined;
    short_description?: string | undefined;
    description?: string | undefined;
    price: number;
    compare_at_price?: number | undefined;
    cost_price?: number | undefined;
    weight?: number | undefined;
    length?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    stock_quantity?: number | undefined;
    low_stock_threshold?: number | undefined;
    track_inventory?: boolean | undefined;
    is_featured?: boolean | undefined;
    is_on_sale?: boolean | undefined;
    is_active?: boolean | undefined;
    include_in_auto_ads?: boolean | undefined;
    status?: string | undefined;
    category_id?: number | undefined;
    category_ids?: number[] | undefined;
    brand_id?: number | null | undefined;
    size_chart_id?: number | undefined;
    meta_title?: string | undefined;
    meta_description?: string | undefined;
    meta_keywords?: string | undefined;
}
export interface ProductVariantData {
    product_id: number;
    sku?: string;
    name: string;
    attributes: any;
    price?: number;
    compare_at_price?: number;
    stock_quantity?: number;
    low_stock_threshold?: number;
    track_inventory?: boolean;
    weight?: number;
    is_default?: boolean;
    has_image?: boolean;
}
export declare class ProductManagementService {
    private static instance;
    private constructor();
    static getInstance(): ProductManagementService;
    createProduct(data: ProductCreateData): Promise<Product>;
    updateProduct(id: number, data: Partial<ProductCreateData>): Promise<Product>;
    deleteProduct(id: number): Promise<void>;
    getProductById(id: number): Promise<Product | null>;
    getAllProducts(page?: number, limit?: number, filters?: {
        search?: string;
        category_id?: number;
        status?: string;
        is_featured?: boolean;
        is_on_sale?: boolean;
    }): Promise<{
        products: Product[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    addProductVariant(data: ProductVariantData): Promise<number>;
    updateProductVariant(id: number, data: Partial<ProductVariantData>): Promise<void>;
    deleteProductVariant(id: number): Promise<void>;
    addProductImage(productId: number, variantId: number | null | undefined, imageUrl: string, altText?: string | undefined, isPrimary?: boolean, orderIndex?: number, thumbUrl?: string | null): Promise<number>;
    deleteProductImage(imageId: number): Promise<void>;
    getProductImages(productId: number): Promise<any[]>;
    reorderProductImages(productId: number, imageIds: number[]): Promise<void>;
    updateProductImageOrder(imageId: number, orderIndex: number): Promise<void>;
    setPrimaryImage(productId: number, imageId: number): Promise<void>;
    getLowStockProducts(): Promise<Product[]>;
    bulkUpdateStock(updates: Array<{
        product_id: number;
        variant_id?: number;
        quantity: number;
    }>): Promise<void>;
    createProductVariantsBulk(variantsData: ProductVariantData[]): Promise<void>;
    duplicateProduct(sourceId: number): Promise<number>;
    private slugifyName;
    private uniqueCopyName;
    private uniqueSlug;
    private allocateCopySku;
    private copyImageToProductFolder;
}
declare const _default: ProductManagementService;
export default _default;
//# sourceMappingURL=productManagementService.d.ts.map