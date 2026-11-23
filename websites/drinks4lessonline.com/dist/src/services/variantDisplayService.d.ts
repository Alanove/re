import type { ProductAttribute } from '../../admin/services/productAttributeService';
export interface VariantDisplayOption {
    value: string;
    variant_id: number | null;
    value_id: number | null;
    color_code: string | null;
    image_url: string | null;
    resolved_image_url: string | null;
    thumb_url?: string | null;
}
export interface VariantDisplayGroup {
    displayName: string;
    storageKey: string;
    display_order: number;
    options: VariantDisplayOption[];
}
export interface VariantDisplayModel {
    groups: VariantDisplayGroup[];
}
export declare function buildVariantDisplayModel(product: {
    images?: Array<{
        attribute_value_id?: number | null;
        image_url?: string;
        thumb_url?: string | null;
        thumb_url_db?: string | null;
    }>;
}, variants: any[], productAttributes: ProductAttribute[]): VariantDisplayModel;
export declare function isColorAttributeName(name: string | undefined | null): boolean;
export declare function buildColorOptionsForListing(product: {
    id: number;
    images?: Array<{
        attribute_value_id?: number | null;
        image_url?: string;
        thumb_url?: string | null;
        thumb_url_db?: string | null;
    }>;
}, variants: any[], productAttributes: ProductAttribute[]): Array<{
    value_id: number | null;
    value: string;
    color_code: string | null;
    image_url: string;
    swatch_image_url: string;
}>;
//# sourceMappingURL=variantDisplayService.d.ts.map