import * as fs from 'fs/promises';
import * as path from 'path';

export interface Project {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  country: string;
  city: string;
  year: number | null;
  category: string;
  client: string;
  featuredImage: string;
  images: string[];
  tags: string[];
  status: string;
  orderIndex: number;
  createdAt: string;
  updatedAt?: string;
}

interface ProjectStore {
  projects: Project[];
}

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects-portfolio.json');

export class ProjectsService {
  private static instance: ProjectsService;

  private constructor() {}

  public static getInstance(): ProjectsService {
    if (!ProjectsService.instance) {
      ProjectsService.instance = new ProjectsService();
    }
    return ProjectsService.instance;
  }

  private parseJsonField(value: string | any[] | null | undefined, defaultValue: any[] = []): any[] {
    if (Array.isArray(value)) return value;
    if (!value) return defaultValue;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  private normalizeProject(row: any): Project {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description || '',
      content: row.content || '',
      country: row.country ?? '',
      city: row.city ?? '',
      year: row.year ?? null,
      category: row.category ?? '',
      client: row.client ?? '',
      featuredImage: row.featuredImage ?? row.featured_image ?? '',
      images: this.parseJsonField(row.images, []),
      tags: this.parseJsonField(row.tags, []),
      status: row.status || 'published',
      orderIndex: row.orderIndex ?? row.order_index ?? 0,
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  private async readStore(): Promise<Project[]> {
    try {
      const raw = await fs.readFile(PROJECTS_FILE, 'utf-8');
      const data = JSON.parse(raw) as ProjectStore;
      return Array.isArray(data.projects) ? data.projects.map((p) => this.normalizeProject(p)) : [];
    } catch {
      return [];
    }
  }

  private async writeStore(projects: Project[]): Promise<void> {
    await fs.mkdir(path.dirname(PROJECTS_FILE), { recursive: true });
    await fs.writeFile(PROJECTS_FILE, JSON.stringify({ projects }, null, 2), 'utf-8');
  }

  private nextId(projects: Project[]): number {
    if (projects.length === 0) return 1;
    return Math.max(...projects.map((p) => p.id)) + 1;
  }

  async getAllProjects(): Promise<Project[]> {
    const projects = await this.readStore();
    return [...projects].sort((a, b) => {
      const o = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      if (o !== 0) return o;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }

  async getProjectById(id: number): Promise<Project | null> {
    const projects = await this.readStore();
    const p = projects.find((x) => x.id === id);
    return p ? this.normalizeProject(p) : null;
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    const projects = await this.readStore();
    const p = projects.find((x) => x.slug === slug);
    return p ? this.normalizeProject(p) : null;
  }

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const projects = await this.readStore();
    const now = new Date().toISOString();
    const id = this.nextId(projects);
    const row: Project = {
      id,
      title: projectData.title,
      slug: projectData.slug,
      description: projectData.description || '',
      content: projectData.content || '',
      country: projectData.country ?? '',
      city: projectData.city ?? '',
      year: projectData.year ?? null,
      category: projectData.category ?? '',
      client: projectData.client ?? '',
      featuredImage: projectData.featuredImage ?? '',
      images: projectData.images || [],
      tags: projectData.tags || [],
      status: projectData.status || 'published',
      orderIndex: projectData.orderIndex || 0,
      createdAt: now,
      updatedAt: now,
    };
    projects.push(row);
    await this.writeStore(projects);
    return row;
  }

  async updateProject(id: number, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project | null> {
    const projects = await this.readStore();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx < 0) return null;

    const cur = projects[idx];
    const merged: Project = {
      ...cur,
      ...updates,
      id: cur.id,
      createdAt: cur.createdAt,
      updatedAt: new Date().toISOString(),
    };
    projects[idx] = merged;
    await this.writeStore(projects);
    return merged;
  }

  async deleteProject(id: number): Promise<boolean> {
    const projects = await this.readStore();
    const next = projects.filter((p) => p.id !== id);
    if (next.length === projects.length) return false;
    await this.writeStore(next);
    return true;
  }

  async getPublishedProjects(): Promise<Project[]> {
    const all = await this.getAllProjects();
    return all.filter((p) => p.status === 'published');
  }

  async getAllCategories(): Promise<string[]> {
    const projects = await this.getAllProjects();
    const allCategories = new Set<string>();

    projects.forEach((project) => {
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach((tag) => {
          if (tag && tag.trim()) {
            allCategories.add(tag.trim());
          }
        });
      }
      if (project.category && project.category.trim()) {
        allCategories.add(project.category.trim());
      }
    });

    return Array.from(allCategories).sort();
  }

  getProjectImagePath(project: any): string {
    if (project.featuredImage) {
      return `/uploads/projects/${project.slug}/${project.featuredImage}`;
    }
    if (project.project_image && project.folder_name) {
      return `/uploads/projects/${project.folder_name}/${project.project_image}`;
    }
    return '';
  }

  isWorkNewStructure(project: any, work: any): boolean {
    return true;
  }

  async addWorkToProject(projectId: number, workData: any): Promise<any> {
    console.log('addWorkToProject called but not implemented yet. Project ID:', projectId);
    return null;
  }

  async updateWorkInProject(projectId: number, workId: number, workData: any): Promise<any> {
    console.log('updateWorkInProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
    return null;
  }

  async deleteWorkFromProject(projectId: number, workId: number): Promise<boolean> {
    console.log('deleteWorkFromProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
    return false;
  }
}

export const projectsService = ProjectsService.getInstance();
