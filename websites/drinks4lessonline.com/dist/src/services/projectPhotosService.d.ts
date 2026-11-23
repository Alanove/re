export interface ProjectPhoto {
    name: string;
    filename: string;
    slug: string;
    imagePath: string;
    category: string;
    fileSize: number;
    fileExtension: string;
}
export interface ProjectCategory {
    name: string;
    slug: string;
    projects: ProjectPhoto[];
    totalProjects: number;
}
export interface ProjectPhotosData {
    categories: Record<string, ProjectCategory>;
    metadata: {
        totalCategories: number;
        totalProjects: number;
        totalImages: number;
        extractedAt: string;
        sourceDirectory: string;
    };
}
export interface IProjectPhotosService {
    getProjectPhotos(): ProjectPhotosData;
    getCategories(): string[];
    getProjectsByCategory(category: string): ProjectPhoto[];
    getProjectBySlug(categorySlug: string, projectSlug: string): ProjectPhoto | null;
    getCategoryBySlug(categorySlug: string): ProjectCategory | null;
}
declare class ProjectPhotosService implements IProjectPhotosService {
    private dataPath;
    constructor();
    getProjectPhotos(): ProjectPhotosData;
    getCategories(): string[];
    getProjectsByCategory(category: string): ProjectPhoto[];
    getProjectBySlug(categorySlug: string, projectSlug: string): ProjectPhoto | null;
    getCategoryBySlug(categorySlug: string): ProjectCategory | null;
    getProjectsByCategorySlug(categorySlug: string): ProjectPhoto[];
    searchProjects(query: string): ProjectPhoto[];
    getProjectsByExtension(extension: string): ProjectPhoto[];
    getStatistics(): {
        totalCategories: number;
        totalProjects: number;
        totalImages: number;
        categories: Record<string, number>;
        fileExtensions: Record<string, number>;
        totalFileSize: number;
    };
}
declare const _default: ProjectPhotosService;
export default _default;
//# sourceMappingURL=projectPhotosService.d.ts.map