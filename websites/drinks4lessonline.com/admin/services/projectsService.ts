import { db } from '../../src/config/database';

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

export class ProjectsService {
  private static instance: ProjectsService;

  private constructor() {}

  public static getInstance(): ProjectsService {
    if (!ProjectsService.instance) {
      ProjectsService.instance = new ProjectsService();
    }
    return ProjectsService.instance;
  }

  private parseJsonField(value: string | null, defaultValue: any = []): any {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  async getAllProjects(): Promise<Project[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        ORDER BY order_index, year DESC
      `);
      
      return (rows as any[]).map((row: any) => ({
        ...row,
        images: this.parseJsonField(row.images, []),
        tags: this.parseJsonField(row.tags, [])
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  async getProjectById(id: number): Promise<Project | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE id = ?
      `, [id]);
      
      if ((rows as any[]).length === 0) return null;
      
      const project = (rows as any[])[0];
      return {
        ...project,
        images: this.parseJsonField(project.images, []),
        tags: this.parseJsonField(project.tags, [])
      };
    } catch (error) {
      console.error('Error fetching project by ID:', error);
      return null;
    }
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE slug = ?
      `, [slug]);
      
      if ((rows as any[]).length === 0) return null;
      
      const project = (rows as any[])[0];
      return {
        ...project,
        images: this.parseJsonField(project.images, []),
        tags: this.parseJsonField(project.tags, [])
      };
    } catch (error) {
      console.error('Error fetching project by slug:', error);
      return null;
    }
  }

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    try {
      const [result] = await db.query(`
        INSERT INTO projects (title, slug, description, content, country, city, year, category, client, featured_image, images, tags, status, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        projectData.title,
        projectData.slug,
        projectData.description || '',
        projectData.content || '',
        projectData.country || '',
        projectData.city || '',
        projectData.year || null,
        projectData.category || '',
        projectData.client || '',
        projectData.featuredImage || '',
        JSON.stringify(projectData.images || []),
        JSON.stringify(projectData.tags || []),
        projectData.status || 'published',
        projectData.orderIndex || 0
      ]);
      
      const insertId = (result as any).insertId;
      const newProject = await this.getProjectById(insertId);
      if (!newProject) throw new Error('Failed to retrieve created project');
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create project');
    }
  }

  async updateProject(id: number, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.slug !== undefined) {
        updateFields.push('slug = ?');
        values.push(updates.slug);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.content !== undefined) {
        updateFields.push('content = ?');
        values.push(updates.content);
      }
      if (updates.country !== undefined) {
        updateFields.push('country = ?');
        values.push(updates.country);
      }
      if (updates.city !== undefined) {
        updateFields.push('city = ?');
        values.push(updates.city);
      }
      if (updates.year !== undefined) {
        updateFields.push('year = ?');
        values.push(updates.year);
      }
      if (updates.category !== undefined) {
        updateFields.push('category = ?');
        values.push(updates.category);
      }
      if (updates.client !== undefined) {
        updateFields.push('client = ?');
        values.push(updates.client);
      }
      if (updates.featuredImage !== undefined) {
        updateFields.push('featured_image = ?');
        values.push(updates.featuredImage);
      }
      if (updates.images !== undefined) {
        updateFields.push('images = ?');
        values.push(JSON.stringify(updates.images));
      }
      if (updates.tags !== undefined) {
        updateFields.push('tags = ?');
        values.push(JSON.stringify(updates.tags));
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.orderIndex !== undefined) {
        updateFields.push('order_index = ?');
        values.push(updates.orderIndex);
      }

      if (updateFields.length === 0) {
        return await this.getProjectById(id);
      }

      values.push(id);
      await db.query(`
        UPDATE projects
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getProjectById(id);
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM projects WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  }

  async getPublishedProjects(): Promise<Project[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE status = 'published'
        ORDER BY order_index, year DESC
      `);
      
      return (rows as any[]).map((row: any) => ({
        ...row,
        images: this.parseJsonField(row.images, []),
        tags: this.parseJsonField(row.tags, [])
      }));
    } catch (error) {
      console.error('Error fetching published projects:', error);
      return [];
    }
  }

  // Helper method to get all unique categories from projects
  async getAllCategories(): Promise<string[]> {
    try {
      const projects = await this.getAllProjects();
      const allCategories = new Set<string>();
      
      projects.forEach(project => {
        if (project.tags && Array.isArray(project.tags)) {
          project.tags.forEach(tag => {
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
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  // Helper method for backward compatibility - get project image path
  getProjectImagePath(project: any): string {
    if (project.featuredImage) {
      return `/uploads/projects/${project.slug}/${project.featuredImage}`;
    }
    if (project.project_image && project.folder_name) {
      return `/uploads/projects/${project.folder_name}/${project.project_image}`;
    }
    return '';
  }

  // Helper method to check if work uses new structure
  isWorkNewStructure(project: any, work: any): boolean {
    // New MySQL-based structure always uses new structure
    // This method exists for backward compatibility with old JSON-based system
    return true;
  }

  // Stub methods for works functionality (TODO: implement works as separate table)
  async addWorkToProject(projectId: number, workData: any): Promise<any> {
    console.log('addWorkToProject called but not implemented yet. Project ID:', projectId);
    // TODO: Implement works as a separate table in the database
    return null;
  }

  async updateWorkInProject(projectId: number, workId: number, workData: any): Promise<any> {
    console.log('updateWorkInProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
    // TODO: Implement works as a separate table in the database
    return null;
  }

  async deleteWorkFromProject(projectId: number, workId: number): Promise<boolean> {
    console.log('deleteWorkFromProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
    // TODO: Implement works as a separate table in the database
    return false;
  }
}

export const projectsService = ProjectsService.getInstance();
