export interface Project {
    id: number;
    title: string;
    slug: string;
    description: string;
    content: string;
    country?: string;
    city?: string;
    year?: number | null;
    category?: string;
    client?: string;
    featuredImage?: string;
    images: string[];
    tags: string[];
    status: string;
    orderIndex: number;
    createdAt: string;
    updatedAt?: string;
}
export declare class ProjectsService {
    private static instance;
    private constructor();
    static getInstance(): ProjectsService;
    private parseJsonField;
    getAllProjects(): Promise<Project[]>;
    getProjectById(id: number): Promise<Project | null>;
    getProjectBySlug(slug: string): Promise<Project | null>;
    createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
    updateProject(id: number, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project | null>;
    deleteProject(id: number): Promise<boolean>;
    getPublishedProjects(): Promise<Project[]>;
    getAllCategories(): Promise<string[]>;
    getProjectImagePath(project: any): string;
    isWorkNewStructure(project: any, work: any): boolean;
    addWorkToProject(projectId: number, workData: any): Promise<any>;
    updateWorkInProject(projectId: number, workId: number, workData: any): Promise<any>;
    deleteWorkFromProject(projectId: number, workId: number): Promise<boolean>;
}
export declare const projectsService: ProjectsService;
//# sourceMappingURL=projectsService.d.ts.map