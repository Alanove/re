// Public-facing projects service - delegates to admin service
import { ProjectsService as AdminProjectsService, Project } from '../../admin/services/projectsService';

const adminProjectsService = AdminProjectsService.getInstance();

export class ProjectsService {
  private static instance: ProjectsService;

  public static getInstance(): ProjectsService {
    if (!ProjectsService.instance) {
      ProjectsService.instance = new ProjectsService();
    }
    return ProjectsService.instance;
  }

  async getAllProjects(): Promise<Project[]> {
    return await adminProjectsService.getPublishedProjects();
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    const project = await adminProjectsService.getProjectBySlug(slug);
    if (project && project.status === 'published') {
      return project;
    }
    return null;
  }

  async getProjectById(id: number): Promise<Project | null> {
    const project = await adminProjectsService.getProjectById(id);
    if (project && project.status === 'published') {
      return project;
    }
    return null;
  }

  // Legacy interface methods for compatibility
  async getProjects(): Promise<{ projects: Project[] }> {
    const projects = await this.getAllProjects();
    return { projects };
  }

  async getCountries(): Promise<string[]> {
    const projects = await this.getAllProjects();
    const countries = [...new Set(projects.map(p => p.country).filter(c => c))];
    return countries as string[];
  }

  async getCategories(): Promise<string[]> {
    const projects = await this.getAllProjects();
    const categories = [...new Set(projects.flatMap(p => p.tags || []))];
    return categories;
  }

  async getFilteredProjects(filters: { categoryUrl?: string; countryUrl?: string }): Promise<Project[]> {
    let projects = await this.getAllProjects();
    
    if (filters.categoryUrl) {
      projects = projects.filter(p => {
        const tags = p.tags || [];
        return tags.some(tag => 
          tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === filters.categoryUrl
        );
      });
    }
    
    if (filters.countryUrl) {
      projects = projects.filter(p => {
        const country = p.country || '';
        return country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === filters.countryUrl;
      });
    }
    
    return projects;
  }

  async getProjectByUrl(url: string): Promise<Project | null> {
    const projects = await this.getAllProjects();
    return projects.find(p => {
      // Try matching by slug first
      if (p.slug === url) return true;
      // Fall back to URL field
      const projectUrl = (p as any).url || p.slug;
      return projectUrl === url;
    }) || null;
  }

  getProjectImagePath(project: Project): string {
    return project.featuredImage || '/images/default-project.jpg';
  }
}

export const projectsService = ProjectsService.getInstance();
export default projectsService;
