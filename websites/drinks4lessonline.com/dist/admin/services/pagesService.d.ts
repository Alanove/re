export interface Page {
    id: number;
    title: string;
    slug: string;
    content: string;
    description?: string;
    metaDescription?: string;
    metaKeywords?: string;
    status: string;
    template?: string;
    parentId?: number | null;
    orderIndex: number;
    createdAt: string;
    updatedAt?: string;
    pageImage?: string;
    pageImageThumb?: string;
    seoImage?: string;
    publishDate?: string | null;
    tags?: PageTag[];
}
export interface PageTag {
    id: number;
    name: string;
    slug: string;
}
export declare class PagesService {
    private static instance;
    private constructor();
    static getInstance(): PagesService;
    getAllPages(): Promise<any[]>;
    getPageById(id: number): Promise<Page | null>;
    getPageBySlug(slug: string): Promise<Page | null>;
    getPageByKey(key: string): Promise<Page | null>;
    createPage(pageData: Omit<Page, 'id' | 'createdAt' | 'updatedAt'>): Promise<Page>;
    updatePage(id: number, updates: Partial<Omit<Page, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Page | null>;
    deletePage(id: number): Promise<boolean>;
    getPublishedPages(): Promise<Page[]>;
    refreshPageImageThumb(pageId: number): Promise<void>;
    getPagePhotos(pageId: number): Promise<any[]>;
    addPagePhoto(pageId: number, filename: string, filePath: string): Promise<any>;
    deletePagePhoto(photoId: number): Promise<boolean>;
    reorderPagePhotos(pageId: number, photoOrders: {
        id: number;
        order: number;
    }[]): Promise<boolean>;
    getPageTags(pageId: number): Promise<PageTag[]>;
    getAllTags(): Promise<PageTag[]>;
    getTopTags(limit?: number): Promise<PageTag[]>;
    getPagesWithPagination(options: {
        page?: number;
        itemsPerPage?: number;
        keyword?: string;
        status?: string;
        tag?: string;
        year?: number;
        month?: number;
        day?: number;
    }): Promise<{
        pages: any[];
        total: number;
    }>;
    searchPages(keyword: string, limit?: number): Promise<any[]>;
    findOrCreateTag(tagName: string): Promise<PageTag>;
    setPageTags(pageId: number, tagNames: string[]): Promise<boolean>;
    getNewsDates(): Promise<string[]>;
    getNewsArchiveDates(): Promise<{
        year: number;
        month: number;
        monthName: string;
    }[]>;
}
export declare const pagesService: PagesService;
//# sourceMappingURL=pagesService.d.ts.map