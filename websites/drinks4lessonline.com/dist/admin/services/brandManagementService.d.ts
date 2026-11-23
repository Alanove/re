export interface Brand {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    website_url: string | null;
    is_featured: boolean;
    display_order: number;
    is_active: boolean;
    meta_title: string | null;
    meta_description: string | null;
    meta_keywords: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface BrandData {
    name: string;
    slug?: string | undefined;
    description?: string | undefined;
    logo_url?: string | undefined;
    website_url?: string | undefined;
    is_featured?: boolean | undefined;
    display_order?: number | undefined;
    is_active?: boolean | undefined;
    meta_title?: string | undefined;
    meta_description?: string | undefined;
    meta_keywords?: string | undefined;
}
export declare class BrandManagementService {
    private static instance;
    private constructor();
    static getInstance(): BrandManagementService;
    getAllBrands(includeInactive?: boolean): Promise<Brand[]>;
    getBrandById(id: number): Promise<Brand | null>;
    getBrandBySlug(slug: string): Promise<Brand | null>;
    createBrand(data: BrandData): Promise<number>;
    updateBrand(id: number, data: Partial<BrandData>): Promise<void>;
    deleteBrand(id: number): Promise<void>;
    private generateSlug;
    getFeaturedBrands(): Promise<Brand[]>;
}
//# sourceMappingURL=brandManagementService.d.ts.map