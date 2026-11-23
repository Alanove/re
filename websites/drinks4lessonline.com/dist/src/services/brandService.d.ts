export interface Brand {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    website_url: string | null;
    is_featured: boolean;
    display_order: number;
}
declare class BrandService {
    getActiveBrands(): Promise<Brand[]>;
    getFeaturedBrands(): Promise<Brand[]>;
    getBrandBySlug(slug: string): Promise<Brand | null>;
}
declare const _default: BrandService;
export default _default;
//# sourceMappingURL=brandService.d.ts.map