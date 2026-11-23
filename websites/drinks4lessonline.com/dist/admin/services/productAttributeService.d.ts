export interface ProductAttribute {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    has_image: boolean;
    display_order: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    values?: ProductAttributeValue[];
    selected_values?: number[];
}
export interface ProductAttributeValue {
    id: number;
    variant_type_id: number;
    value: string;
    sku_code: string | null;
    color_code: string | null;
    display_order: number;
    is_active: boolean;
    is_preselected: boolean;
    created_at: Date;
    updated_at: Date;
    image_url?: string | null;
    thumb_url?: string | null;
}
export interface ProductAttributeData {
    name: string;
    slug?: string;
    description?: string;
    has_image?: boolean;
    display_order?: number;
    is_active?: boolean;
    values?: string[];
}
export declare class ProductAttributeService {
    private static instance;
    private constructor();
    static getInstance(): ProductAttributeService;
    getAllProductAttributes(includeInactive?: boolean): Promise<ProductAttribute[]>;
    getProductAttributeById(id: number): Promise<ProductAttribute | null>;
    createProductAttribute(data: ProductAttributeData): Promise<number>;
    updateProductAttribute(id: number, data: Partial<ProductAttributeData>): Promise<void>;
    deleteProductAttribute(id: number): Promise<void>;
    private addProductAttributeValues;
    private generateSlug;
    getProductAttributesWithImages(): Promise<ProductAttribute[]>;
    checkAttributeUsage(attributeName: string): Promise<string[]>;
    updateAttributeValue(valueId: number, data: {
        value?: string;
        sku_code?: string | null;
        color_code?: string | null;
        display_order?: number;
        is_active?: boolean;
        is_preselected?: boolean;
    }): Promise<void>;
    checkAttributeValueUsage(valueId: number): Promise<string[]>;
    addAttributeValue(variantTypeId: number, data: {
        value: string;
        sku_code?: string | null;
        color_code?: string | null;
        display_order?: number;
        is_active?: boolean;
        is_preselected?: boolean;
    }): Promise<number>;
    deleteAttributeValue(valueId: number): Promise<void>;
    updateAttributeValues(variantTypeId: number, values: Array<{
        id?: number;
        value: string;
        sku_code?: string | null;
        color_code?: string | null;
        display_order?: number;
        is_active?: boolean;
        is_preselected?: boolean;
    }>): Promise<void>;
    uploadAttributeValueImage(valueId: number, imageUrl: string, thumbUrl?: string | null): Promise<void>;
    clearAttributeValueGlobalImage(valueId: number): Promise<string | null>;
    uploadProductAttributeValueImage(productId: number, valueId: number, imageUrl: string, thumbUrl?: string | null): Promise<void>;
    deleteAttributeValueImage(valueId: number): Promise<void>;
    deleteProductAttributeValueImage(productId: number, valueId: number): Promise<number>;
    getProductAttributes(productId: number): Promise<ProductAttribute[]>;
    addProductAttribute(productId: number, variantTypeId: number): Promise<void>;
    removeProductAttribute(productId: number, variantTypeId: number): Promise<void>;
    updateProductAttributeSelection(productId: number, variantTypeId: number, selectedValues: number[]): Promise<void>;
    getProductAttributeValues(productId: number): Promise<Map<string, string[]>>;
}
declare const _default: ProductAttributeService;
export default _default;
//# sourceMappingURL=productAttributeService.d.ts.map