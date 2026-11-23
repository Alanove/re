export declare function isProductFolderImageUrl(productId: number, imageUrl: string): boolean;
export declare function resolveProductImageUrl(productId: number, storedUrl: string | null | undefined): string | null;
export declare function resolveProductThumbUrl(productId: number, imageUrl: string | null | undefined, storedThumbUrl: string | null | undefined): string | null;
export declare function normalizeProductImageRow<T extends {
    image_url?: string | null;
    thumb_url?: string | null;
}>(productId: number, row: T): T;
export declare function normalizeProductImages<T extends {
    image_url?: string | null;
    thumb_url?: string | null;
}>(productId: number, rows: T[]): T[];
export declare function migratedProductImageUrls(productId: number, sourceImageUrl: string): {
    image_url: string;
    thumb_url: string;
};
//# sourceMappingURL=productImageUrlService.d.ts.map