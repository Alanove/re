import { Page } from '../../admin/services/pagesService';
import { MenuItem, SiteData, SeoData, PageData, PagesData } from '../types';
export declare class PagesService {
    private static instance;
    private cachedSettings;
    private cachedMenus;
    private cacheTime;
    private cacheDuration;
    private constructor();
    static getInstance(): PagesService;
    private loadCache;
    private convertMenuItems;
    getAllPages(): Promise<Page[]>;
    getPageBySlug(slug: string): Promise<Page | null>;
    getPageById(id: number): Promise<Page | null>;
    getPagesData(): PagesData;
    getMenuItems(): MenuItem[];
    getMenu(name: string): MenuItem[];
    getPageData(pageKey: string): PageData | null;
    getSiteData(): SiteData;
    getSeoData(pageKey: string, customData?: Partial<SeoData>): SeoData;
    getPageKeyFromPath(path: string): string;
    initialize(): Promise<void>;
    reloadCache(): Promise<void>;
}
declare const instance: PagesService;
export default instance;
//# sourceMappingURL=pagesService.d.ts.map