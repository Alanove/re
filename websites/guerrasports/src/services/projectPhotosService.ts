import * as fs from 'fs';
import { DATA_PATHS } from '../constants';

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

class ProjectPhotosService implements IProjectPhotosService {
  private dataPath: string;

  constructor() {
    this.dataPath = DATA_PATHS.PROJECT_PHOTOS_FILE;
  }

  /**
   * Get all project photos data
   */
  getProjectPhotos(): ProjectPhotosData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data) as ProjectPhotosData;
    } catch (error) {
      console.error('Error reading project photos file:', error);
      return {
        categories: {},
        metadata: {
          totalCategories: 0,
          totalProjects: 0,
          totalImages: 0,
          extractedAt: new Date().toISOString(),
          sourceDirectory: ''
        }
      };
    }
  }

  /**
   * Get all category names
   */
  getCategories(): string[] {
    const data = this.getProjectPhotos();
    return Object.keys(data.categories);
  }

  /**
   * Get projects by category name
   */
  getProjectsByCategory(category: string): ProjectPhoto[] {
    const data = this.getProjectPhotos();
    return data.categories[category]?.projects || [];
  }

  /**
   * Get a specific project by category slug and project slug
   */
  getProjectBySlug(categorySlug: string, projectSlug: string): ProjectPhoto | null {
    const data = this.getProjectPhotos();
    
    for (const category of Object.values(data.categories)) {
      if (category.slug === categorySlug) {
        const project = category.projects.find(p => p.slug === projectSlug);
        return project || null;
      }
    }
    
    return null;
  }

  /**
   * Get a category by its slug
   */
  getCategoryBySlug(categorySlug: string): ProjectCategory | null {
    const data = this.getProjectPhotos();
    
    for (const category of Object.values(data.categories)) {
      if (category.slug === categorySlug) {
        return category;
      }
    }
    
    return null;
  }

  /**
   * Get projects by category slug
   */
  getProjectsByCategorySlug(categorySlug: string): ProjectPhoto[] {
    const category = this.getCategoryBySlug(categorySlug);
    return category?.projects || [];
  }

  /**
   * Search projects by name
   */
  searchProjects(query: string): ProjectPhoto[] {
    const data = this.getProjectPhotos();
    const results: ProjectPhoto[] = [];
    const searchTerm = query.toLowerCase();

    for (const category of Object.values(data.categories)) {
      const matchingProjects = category.projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm)
      );
      results.push(...matchingProjects);
    }

    return results;
  }

  /**
   * Get projects by file extension
   */
  getProjectsByExtension(extension: string): ProjectPhoto[] {
    const data = this.getProjectPhotos();
    const results: ProjectPhoto[] = [];
    const ext = extension.toLowerCase();

    for (const category of Object.values(data.categories)) {
      const matchingProjects = category.projects.filter(project =>
        project.fileExtension.toLowerCase() === ext
      );
      results.push(...matchingProjects);
    }

    return results;
  }

  /**
   * Get statistics about the project photos
   */
  getStatistics() {
    const data = this.getProjectPhotos();
    const stats = {
      totalCategories: data.metadata.totalCategories,
      totalProjects: data.metadata.totalProjects,
      totalImages: data.metadata.totalImages,
      categories: {} as Record<string, number>,
      fileExtensions: {} as Record<string, number>,
      totalFileSize: 0
    };

    for (const category of Object.values(data.categories)) {
      stats.categories[category.name] = category.totalProjects;
      
      for (const project of category.projects) {
        stats.totalFileSize += project.fileSize;
        stats.fileExtensions[project.fileExtension] = (stats.fileExtensions[project.fileExtension] || 0) + 1;
      }
    }

    return stats;
  }
}

export default new ProjectPhotosService(); 