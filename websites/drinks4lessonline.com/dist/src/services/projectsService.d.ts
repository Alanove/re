import { Project } from '../../admin/services/projectsService';
export declare class ProjectsService {
    private static instance;
    static getInstance(): ProjectsService;
    getAllProjects(): Promise<Project[]>;
    getProjectBySlug(slug: string): Promise<Project | null>;
    getProjectById(id: number): Promise<Project | null>;
    getProjects(): Promise<{
        projects: Project[];
    }>;
    getCountries(): Promise<string[]>;
    getCategories(): Promise<string[]>;
    getFilteredProjects(filters: {
        categoryUrl?: string;
        countryUrl?: string;
    }): Promise<Project[]>;
    getProjectByUrl(url: string): Promise<Project | null>;
    getProjectImagePath(project: Project): string;
}
export declare const projectsService: ProjectsService;
export default projectsService;
//# sourceMappingURL=projectsService.d.ts.map