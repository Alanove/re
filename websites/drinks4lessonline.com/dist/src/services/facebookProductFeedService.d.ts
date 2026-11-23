export type FacebookFeedItem = {
    id: string;
    itemGroupId: string;
    title: string;
    description: string;
    availability: string;
    condition: string;
    price: string;
    link: string;
    imageLink: string;
    brand: string;
    size: string;
    color: string;
    salePrice: string;
    additionalImageUrls: string[];
};
export declare function toAbsoluteProductUrl(baseUrl: string, relativeOrAbsolute: string): string | null;
export interface FacebookFeedBuildOptions {
    baseUrl: string;
    currencyCode: string;
    fallbackBrand: string;
    channelTitle?: string;
    facebookAppId?: string;
}
export interface FacebookFeedBuildResult {
    xml: string;
    rowCount: number;
}
export declare function collectFacebookFeedItems(options: FacebookFeedBuildOptions): Promise<FacebookFeedItem[]>;
export declare function buildFacebookProductFeedRssXml(items: FacebookFeedItem[], channelTitle: string, channelLink: string, rssOpts?: {
    facebookAppId?: string;
}): string;
export declare function buildFacebookProductFeedXml(options: FacebookFeedBuildOptions): Promise<FacebookFeedBuildResult>;
export declare function buildFacebookProductFeedWithStoreSettings(baseUrl: string): Promise<FacebookFeedBuildResult>;
//# sourceMappingURL=facebookProductFeedService.d.ts.map