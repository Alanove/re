interface SiteSettings {
    siteTitle: string;
    siteSlogan?: string;
    siteDescription: string;
    logo: string;
    favicon: string;
    siteImage?: string;
    siteUrl: string;
    contactEmail: string;
    contactPhone: string;
    contactWhatsapp?: string;
    address: string;
    socialMedia: {
        facebook?: string;
        twitter?: string;
        instagram?: string;
        linkedin?: string;
        youtube?: string;
    };
    seo: {
        defaultTitle: string;
        defaultDescription: string;
        defaultKeywords: string;
    };
    downloadLinks: {
        portfolio?: string;
        brochure?: string;
        catalog?: string;
    };
    googleMaps: {
        embedUrl?: string;
        directionsUrl?: string;
        latitude?: string;
        longitude?: string;
    };
    analyticsScript?: string;
}
export declare class SiteSettingsService {
    private static instance;
    private settingsCache;
    private cacheTime;
    private cacheDuration;
    private constructor();
    static getInstance(): SiteSettingsService;
    private loadSettings;
    private saveSetting;
    private getDefaultSettings;
    getAllSettings(): Promise<SiteSettings>;
    getSiteTitle(): Promise<string>;
    getSiteDescription(): Promise<string>;
    getSiteUrl(): Promise<string>;
    getContactEmail(): Promise<string>;
    getContactPhone(): Promise<string>;
    getContactWhatsapp(): Promise<string>;
    getAddress(): Promise<string>;
    getSocialMedia(): Promise<SiteSettings['socialMedia']>;
    getSeoSettings(): Promise<SiteSettings['seo']>;
    getDownloadLinks(): Promise<SiteSettings['downloadLinks']>;
    getGoogleMapsSettings(): Promise<SiteSettings['googleMaps']>;
    updateSettings(newSettings: Partial<SiteSettings>): Promise<boolean>;
    reloadSettings(): void;
}
export {};
//# sourceMappingURL=siteSettingsService.d.ts.map