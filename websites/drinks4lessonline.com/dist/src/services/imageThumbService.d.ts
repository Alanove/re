export declare function publicUrlToAbsolutePath(publicUrl: string): string | null;
export declare function thumbPublicUrlFromSourcePublicUrl(imagePublicUrl: string): string;
export declare function generateThumbForPublicUrl(imagePublicUrl: string): Promise<string | null>;
export declare function deleteThumbFileForSourceImageUrl(imagePublicUrl: string | null | undefined): void;
export declare function deleteThumbFileByThumbUrl(thumbPublicUrl: string | null | undefined): void;
export declare function resolveListingThumbUrl(imagePublicUrl: string, dbThumbUrl: string | null | undefined): string | null;
//# sourceMappingURL=imageThumbService.d.ts.map