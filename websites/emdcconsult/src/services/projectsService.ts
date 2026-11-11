import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS, getProjectImageUrl, getWorkImageUrl, getProjectDirPath } from '../constants';
import {
  ProjectsData,
  ProjectAnalytics,
  CategoryAnalytics,
  CountryAnalytics,
  Project,
  ProjectFilters,
  IProjectsService
} from '../types';

class ProjectsService implements IProjectsService {
  private readonly projectsPath: string;
  private readonly analyticsPath: string;
  private readonly categoriesPath: string;
  private readonly countriesPath: string;

  constructor() {
    this.projectsPath = DATA_PATHS.PROJECTS_FILE;
    this.analyticsPath = DATA_PATHS.PROJECT_ANALYTICS_FILE;
    // Use data paths constants for categories and countries
    this.categoriesPath = DATA_PATHS.DATA_DIR + '/categories.json';
    this.countriesPath = DATA_PATHS.DATA_DIR + '/countries.json';
  }

  getProjects(): ProjectsData {
    try {
      return JSON.parse(fs.readFileSync(this.projectsPath, 'utf8')) as ProjectsData;
    } catch (error) {
      console.error('Error reading projects file:', error);
      return { projects: [] };
    }
  }

  getAnalytics(): ProjectAnalytics {
    try {
      return JSON.parse(fs.readFileSync(this.analyticsPath, 'utf8')) as ProjectAnalytics;
    } catch (error) {
      console.error('Error reading analytics file:', error);
      return { categories: [], countries: [] };
    }
  }

  getCategories(): string[] {
    try {
      // Use the actual categories from our data file
      const categoriesData = JSON.parse(fs.readFileSync(this.categoriesPath, 'utf8'));
      return categoriesData.categories || [];
    } catch (error) {
      console.error('Error getting categories from categories file:', error);
      // Fallback to projects data
      try {
        const projectsData = this.getProjects();
        const categoriesSet = new Set<string>();
        projectsData.projects.forEach(project => {
          if (project.categories) {
            project.categories.forEach(cat => categoriesSet.add(cat));
          }
        });
        return Array.from(categoriesSet).sort();
      } catch (fallbackError) {
        console.error('Error getting categories from projects fallback:', fallbackError);
        return [];
      }
    }
  }

  getCountries(): string[] {
    try {
      // Use the actual countries from our data file
      const countriesData = JSON.parse(fs.readFileSync(this.countriesPath, 'utf8'));
      return countriesData.countries || [];
    } catch (error) {
      console.error('Error getting countries from countries file:', error);
      // Fallback to projects data
      try {
        const projectsData = this.getProjects();
        const countriesSet = new Set<string>();
        projectsData.projects.forEach(project => {
          if (project.country) {
            countriesSet.add(project.country);
          }
        });
        return Array.from(countriesSet).sort();
      } catch (fallbackError) {
        console.error('Error getting countries from projects fallback:', fallbackError);
        return [];
      }
    }
  }

  getCategoryByUrl(url: string): CategoryAnalytics | undefined {
    const categories = this.getCategories();
    const category = categories.find(cat => 
      cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === url
    );
    if (category) {
      return {
        name: category,
        real: [category],
        url: url
      };
    }
    return undefined;
  }

  getCountryByUrl(url: string): CountryAnalytics | undefined {
    const countries = this.getCountries();
    const country = countries.find(c => 
      c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === url
    );
    if (country) {
      return {
        name: country,
        real: [country],
        url: url
      };
    }
    return undefined;
  }

  /**
   * Map countries to regions for grouping
   */
  private getCountryToRegionMap(): Record<string, string> {
    return {
      'Canada': 'Americas',
      'Latin America': 'Americas',
      'Benin': 'Africa',
      'Congo': 'Africa',
      'Côte d\'Ivoire': 'Africa',
      'Cote d\'Ivoire': 'Africa',
      'Egypt': 'Africa',
      'Nigeria': 'Africa',
      'Tanzania': 'Africa',
      'Iraq': 'Gulf and Middle East',
      'Lebanon': 'Gulf and Middle East',
      'UAE': 'Gulf and Middle East',
      'Saudi Arabia': 'Saudi Arabia'
    };
  }

  /**
   * Get all available regions
   */
  getRegions(): string[] {
    return ['Americas', 'Africa', 'Gulf and Middle East', 'Saudi Arabia'];
  }

  /**
   * Get countries in a specific region
   */
  getCountriesInRegion(region: string): string[] {
    const countryToRegion = this.getCountryToRegionMap();
    const allCountries = this.getCountries();
    return allCountries.filter(country => countryToRegion[country] === region);
  }

  /**
   * Get region for a specific country
   */
  getRegionForCountry(country: string): string | undefined {
    const countryToRegion = this.getCountryToRegionMap();
    return countryToRegion[country];
  }

  /**
   * Get region by URL slug
   */
  getRegionByUrl(url: string): string | undefined {
    const regions = this.getRegions();
    return regions.find(region => 
      region.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === url
    );
  }

  getFilteredProjects({ categoryUrl, countryUrl, regionUrl }: ProjectFilters & { regionUrl?: string }): Project[] {
    const projectsData = this.getProjects();
    let filtered = projectsData.projects;
    
    if (categoryUrl) {
      const catObj = this.getCategoryByUrl(categoryUrl);
      if (catObj) {
        filtered = filtered.filter(project =>
          project.categories && project.categories.includes(catObj.name)
        );
      } else {
        filtered = [];
      }
    }
    
    // Handle region filtering (new grouping system)
    if (regionUrl) {
      const region = this.getRegionByUrl(regionUrl);
      if (region) {
        const countriesInRegion = this.getCountriesInRegion(region);
        filtered = filtered.filter(project =>
          project.country && countriesInRegion.includes(project.country)
        );
      } else {
        filtered = [];
      }
    } else if (countryUrl) {
      // Legacy country filtering (for individual project details)
      const countryObj = this.getCountryByUrl(countryUrl);
      if (countryObj) {
        filtered = filtered.filter(project =>
          project.country === countryObj.name
        );
      } else {
        filtered = [];
      }
    }
    
    // Sort by priority (high to low) and reverse chronological order (newest first)
    // First reverse the array to get newest first (based on file order)
    filtered.reverse();
    
    // Then sort by priority (stable sort will keep relative order for equal priority)
    filtered.sort((a, b) => {
      const priorityA = (typeof a.priority !== 'undefined') ? a.priority : 1000;
      const priorityB = (typeof b.priority !== 'undefined') ? b.priority : 1000;
      return priorityB - priorityA;
    });

    return filtered;
  }

  getTopCategories(limit = 10): string[] {
    const data = this.getProjects();
    const countMap: Record<string, number> = {};
    data.projects.forEach(project => {
      if (project.categories) {
        project.categories.forEach(cat => {
          countMap[cat] = (countMap[cat] || 0) + 1;
        });
      }
    });
    const sorted = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cat]) => cat);
    return sorted.slice(0, limit);
  }

  getTopLocations(limit = 10): string[] {
    const data = this.getProjects();
    const countMap: Record<string, number> = {};
    data.projects.forEach(project => {
      if (project.country) {
        countMap[project.country] = (countMap[project.country] || 0) + 1;
      }
    });
    const sorted = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([country]) => country);
    return sorted.slice(0, limit);
  }

  getProjectByUrl(url: string): Project | undefined {
    const projectsData = this.getProjects();
    return projectsData.projects.find(project => project.url === url);
  }

  /**
   * Check if a project uses the new folder structure
   */
  isNewStructure(project: Project): boolean {
    const projectDir = getProjectDirPath(project.folder_name || 'temp');
    
    if (!fs.existsSync(projectDir)) {
      return false;
    }

    // Check if project has work folders (indicating new structure)
    const items = fs.readdirSync(projectDir, { withFileTypes: true });
    const workFolders = items.filter(item => 
      item.isDirectory() && 
      !item.name.startsWith('.') && 
      item.name !== 'temp'
    );

    // If no work folders, it's definitely old structure
    if (workFolders.length === 0) {
      return false;
    }

    // If there are work folders, check if this is a mixed structure project
    // For mixed structure projects, we need to check the specific work
    return true;
  }

  /**
   * Check if a specific work uses the new folder structure
   */
  isWorkNewStructure(project: Project, work: any): boolean {
    const projectDir = getProjectDirPath(project.folder_name || 'temp');
    
    if (!fs.existsSync(projectDir)) {
      return false;
    }

    // Check if the work folder exists
    const workFolderPath = path.join(projectDir, work.folder_name || 'temp');
    return fs.existsSync(workFolderPath) && fs.statSync(workFolderPath).isDirectory();
  }

  /**
   * Get the correct image path for a project (always uses new structure)
   */
  getProjectImagePath(project: Project): string {
    // Always use new structure: /projects/[project-name]/[project-image]
    return getProjectImageUrl(project.folder_name || 'temp', project.project_image);
  }

  /**
   * Get the correct image path for a work (handles both old and new structures)
   */
  getWorkImagePath(project: Project, work: any, imageName: string): string {
    if (this.isWorkNewStructure(project, work)) {
      // New structure: /projects/[project-name]/[work-folder]/[image]
      return getWorkImageUrl(project.folder_name || 'temp', work.folder_name || 'temp', imageName);
    } else {
      // Old structure: /projects/[project-name]/[image] (images directly in project folder)
      return getProjectImageUrl(project.folder_name || 'temp', imageName);
    }
  }
}

export default new ProjectsService(); 