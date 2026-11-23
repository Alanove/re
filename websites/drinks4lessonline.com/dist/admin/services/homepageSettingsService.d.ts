export declare const DEFAULT_HOMEPAGE_BANNER_IMAGE = "/images/Firefly-2.jpg";
export declare const DEFAULT_HOMEPAGE_BANNER_TEXT = "SHOP GUERRA PRODUCTS";
export declare const DEFAULT_HOMEPAGE_BANNER_LINK = "/products";
export declare const DEFAULT_NEW_ARRIVALS_TITLE = "New Arrivals";
export declare const DEFAULT_SALE_TITLE = "Sale";
export declare const DEFAULT_SALE_META_DESCRIPTION = "Shop products currently on sale at Drinks4Less.";
export interface HomepageSettings {
    bannerImage: string;
    bannerText: string;
    bannerLink: string;
    newArrivalsTitle: string;
    saleTitle: string;
    saleEnabled: boolean;
    saleMetaTitle: string;
    saleMetaDescription: string;
}
export declare function cleanHomepageLink(value: unknown, fallback?: string): string;
export declare class HomepageSettingsService {
    private static instance;
    private constructor();
    static getInstance(): HomepageSettingsService;
    getSettings(): Promise<HomepageSettings>;
    updateSettings(settings: Partial<HomepageSettings>): Promise<void>;
}
//# sourceMappingURL=homepageSettingsService.d.ts.map