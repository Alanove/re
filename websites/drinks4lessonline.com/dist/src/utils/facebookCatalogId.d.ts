export type FacebookCatalogIdInput = {
    productId: number;
    variantId?: number | null;
    productSku?: string | null;
    variantSku?: string | null;
};
export declare function resolveFacebookCatalogContentId(input: FacebookCatalogIdInput): string;
export declare function resolveFacebookCatalogContentIdFromDb(productId: number, variantId?: number | null): Promise<string>;
export declare function resolveFacebookCatalogContentIdsForItems(items: Array<{
    product_id: number;
    variant_id?: number | null;
}>): Promise<string[]>;
export type MetaShopCatalogLine = {
    catalogContentId: string;
    quantity: number;
};
export type ResolvedCatalogProduct = {
    productId: number;
    variantId: number | null;
};
export declare function parseMetaShopProductsParam(productsParam: string): MetaShopCatalogLine[];
export declare function resolveProductVariantFromCatalogContentId(catalogContentId: string): Promise<ResolvedCatalogProduct | null>;
//# sourceMappingURL=facebookCatalogId.d.ts.map