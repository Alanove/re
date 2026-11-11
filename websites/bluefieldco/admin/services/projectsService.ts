import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS, getProjectImageUrl, getWorkImageUrl, getProjectDirPath } from '../../src/constants';

export interface ProjectWork {
  description: string;
  folder_name: string;
  details: {
    project?: string;
    client?: string;
    architect?: string;
    developer?: string;
    contractor?: string;
    location?: string;
    year?: string;
  };
  scope_of_work: string[];
  images: string[];
  categories: string[];
}

export interface Project {
  title: string;
  folder_name: string;
  project_image: string;
  works: ProjectWork[];
  categories: string[];
  url: string;
  // Project details
  bau?: string;
  area?: string;
  size?: string;
  quantity?: string;
  contractor?: string;
  architect?: string;
  client?: string;
  scope?: string;
  country?: string;
  mapLocation?: string;
  land?: string;
  capacity?: string;
  districts?: string;
  owner?: string;
  consultant?: string;
  all_text?: string;
  priority?: number;
}

export interface ProjectsData {
  projects: Project[];
}

export class ProjectsService {
  private static instance: ProjectsService;
  private projectsPath: string;

  private constructor() {
    this.projectsPath = DATA_PATHS.PROJECTS_FILE;
  }

  public static getInstance(): ProjectsService {
    if (!ProjectsService.instance) {
      ProjectsService.instance = new ProjectsService();
    }
    return ProjectsService.instance;
  }

  /**
   * Load all projects
   */
  public loadProjects(): ProjectsData {
    try {
      const content = fs.readFileSync(this.projectsPath, 'utf8');
      return JSON.parse(content) as ProjectsData;
    } catch (error) {
      console.error('Error loading projects:', error);
      return { projects: [] };
    }
  }

  /**
   * Save projects to file
   */
  public saveProjects(data: ProjectsData): void {
    try {
      fs.writeFileSync(this.projectsPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving projects:', error);
      throw new Error('Failed to save projects');
    }
  }

  /**
   * Get all projects
   */
  public getAllProjects(): Project[] {
    const data = this.loadProjects();
    return data.projects;
  }

  /**
   * Get project by ID (index)
   */
  public getProjectById(id: number): Project | null {
    const projects = this.getAllProjects();
    return projects[id] || null;
  }

  /**
   * Create new project
   */
  public createProject(project: Omit<Project, 'url'>): Project {
    const data = this.loadProjects();
    const newProject: Project = {
      ...project,
      url: this.generateUrl(project.title)
    };
    data.projects.push(newProject);
    this.saveProjects(data);
    return newProject;
  }

  /**
   * Update project
   */
  public updateProject(id: number, project: Omit<Project, 'url'>): Project | null {
    const data = this.loadProjects();
    if (id < 0 || id >= data.projects.length) {
      return null;
    }
    
    const updatedProject: Project = {
      ...project,
      url: this.generateUrl(project.title)
    };
    data.projects[id] = updatedProject;
    this.saveProjects(data);
    return updatedProject;
  }

  /**
   * Delete project
   */
  public deleteProject(id: number): boolean {
    const data = this.loadProjects();
    if (id < 0 || id >= data.projects.length) {
      return false;
    }
    
    data.projects.splice(id, 1);
    this.saveProjects(data);
    return true;
  }

  /**
   * Add work to project
   */
  public addWorkToProject(projectId: number, work: ProjectWork): ProjectWork | null {
    const data = this.loadProjects();
    if (projectId < 0 || projectId >= data.projects.length) {
      return null;
    }
    
    const project = data.projects[projectId];
    if (!project) {
      return null;
    }
    
    if (!project.works) {
      project.works = [];
    }
    
    project.works.push(work);
    this.saveProjects(data);
    return work;
  }

  /**
   * Update work in project
   */
  public updateWorkInProject(projectId: number, workId: number, work: ProjectWork): ProjectWork | null {
    const data = this.loadProjects();
    if (projectId < 0 || projectId >= data.projects.length) {
      return null;
    }
    
    const project = data.projects[projectId];
    if (!project || !project.works) {
      return null;
    }
    
    if (workId < 0 || workId >= project.works.length) {
      return null;
    }
    
    project.works[workId] = work;
    this.saveProjects(data);
    return work;
  }

  /**
   * Move project up or down in priority
   */
  public moveProject(originalIndex: number, direction: 'up' | 'down'): boolean {
    const data = this.loadProjects();
    const projects = data.projects;
    
    // Create a working copy with original indices to track them
    // We need to reconstruct the sorted view that the user sees
    const sortedProjects = projects.map((p, index) => ({ ...p, originalIndex: index }));
    
    // Sort exactly as the controller does: Reverse then Priority Desc
    // Note: The controller reverses THEN sorts. 
    // Implementation in controller:
    // projects.reverse();
    // projects.sort((a, b) => priorityB - priorityA);
    
    // To match this, we need to replicate the sort logic
    // 1. Reverse to establish "newest first" base order
    // We need to be careful not to mutate the original array if we want to map back easily, 
    // but here we want to find the "visual neighbor"
    
    // Let's create a view of the current state
    const view = [...sortedProjects];
    view.reverse();
    view.sort((a, b) => {
      const priorityA = (typeof a.priority !== 'undefined') ? a.priority : 1000;
      const priorityB = (typeof b.priority !== 'undefined') ? b.priority : 1000;
      return priorityB - priorityA; 
    });
    
    // Find the item in the sorted view that corresponds to the originalIndex
    const viewIndex = view.findIndex(p => p.originalIndex === originalIndex);
    
    if (viewIndex === -1) {
      return false; 
    }
    
    // Calculate swap target index in the VIEW
    let swapTargetViewIndex = -1;
    
    if (direction === 'up') {
      // Visual "Up" means higher on the list, so lower index in the array
      swapTargetViewIndex = viewIndex - 1;
    } else {
      // Visual "Down" means lower on the list, so higher index in the array
      swapTargetViewIndex = viewIndex + 1;
    }
    
    // Check bounds
    if (swapTargetViewIndex < 0 || swapTargetViewIndex >= view.length) {
      return false; // Can't move
    }
    
    // Get the two projects involved
    const projectA = view[viewIndex];
    const projectB = view[swapTargetViewIndex];
    
    // We need to swap their priorities.
    // If they have the same priority, we need to nudge one.
    // But since we want to swap their positions effectively, let's look at their priorities.
    
    let priorityA = (typeof projectA.priority !== 'undefined') ? projectA.priority : 1000;
    let priorityB = (typeof projectB.priority !== 'undefined') ? projectB.priority : 1000;
    
    // If priorities are different, we can just swap them? 
    // Not necessarily, if there are gaps or other items.
    // Simplest approach for visual reordering: 
    // Swap the priorities. 
    
    if (priorityA === priorityB) {
      // If priorities are equal, the sort relied on the array order (reversed).
      // To force a swap in priority sort, we need to make them different.
      // Let's increment one's priority and decrement the other's slightly or just swap them.
      // But we are using integers.
      
      // Strategy: Normalize priorities if they are clashing or just bad.
      // Or, just swap the priority values.
      // If they are equal, swapping does nothing.
      // So if equal, we need to change them.
      
      if (direction === 'up') {
        // A wants to go UP (become higher index in 0-based array? wait. 
        // Logic: Sort is Priority DESC. Higher priority = Lower Index (Top of list).
        // A is at viewIndex. Target is viewIndex - 1 (Top).
        // Target has HIGHER or EQUAL priority than A.
        // We want A to have Target's priority, and Target to have A's priority?
        // If we swap priorities:
        // A gets HighP, Target gets LowP. 
        // Sort: A(High) comes before Target(Low). A moves up. Correct.
        
        // But what if priorities are EQUAL?
        // Then swapping does nothing.
        // We need A to be HIGHER than Target.
        priorityA = priorityB + 1;
        // But this might clash with the one *above* Target.
      } else {
         // A wants to go DOWN (become higher index). 
         // Target is viewIndex + 1 (Bottom).
         // Target has LOWER or EQUAL priority.
         // We want A to have LowerP, Target to have HigherP.
         priorityA = priorityB - 1;
      }
    } else {
       // Priorities different. Swap them.
       const temp = priorityA;
       priorityA = priorityB;
       priorityB = temp;
    }
    
    // Update the original projects array with new priorities
    if (data.projects[projectA.originalIndex]) {
        data.projects[projectA.originalIndex].priority = priorityA;
    }
    if (data.projects[projectB.originalIndex]) {
        data.projects[projectB.originalIndex].priority = priorityB;
    }
    
    this.saveProjects(data);
    return true;
  }

  /**
   * Delete work from project
   */
  public deleteWorkFromProject(projectId: number, workId: number): boolean {
    const data = this.loadProjects();
    if (projectId < 0 || projectId >= data.projects.length) {
      return false;
    }
    
    const project = data.projects[projectId];
    if (!project || !project.works) {
      return false;
    }
    
    if (workId < 0 || workId >= project.works.length) {
      return false;
    }
    
    project.works.splice(workId, 1);
    this.saveProjects(data);
    return true;
  }

  /**
   * Generate URL from title
   */
  private generateUrl(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Get all unique categories from all projects
   */
  public getAllCategories(): string[] {
    const projects = this.getAllProjects();
    const categories = new Set<string>();
    
    projects.forEach(project => {
      if (project.categories) {
        project.categories.forEach(cat => categories.add(cat));
      }
      if (project.works) {
        project.works.forEach(work => {
          if (work.categories) {
            work.categories.forEach(cat => categories.add(cat));
          }
        });
      }
    });
    
    return Array.from(categories).sort();
  }

  /**
   * Check if a project uses the new folder structure
   */
  public isNewStructure(project: Project): boolean {
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
  public isWorkNewStructure(project: Project, work: ProjectWork): boolean {
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
  public getProjectImagePath(project: Project): string {
    // Always use new structure: /projects/[project-name]/[project-image]
    return getProjectImageUrl(project.folder_name || 'temp', project.project_image);
  }

  /**
   * Get the correct image path for a work (handles both old and new structures)
   */
  public getWorkImagePath(project: Project, work: ProjectWork, imageName: string): string {
    if (this.isWorkNewStructure(project, work)) {
      // New structure: /projects/[project-name]/[work-folder]/[image]
      return getWorkImageUrl(project.folder_name || 'temp', work.folder_name || 'temp', imageName);
    } else {
      // Old structure: /projects/[project-name]/[image] (images directly in project folder)
      return getProjectImageUrl(project.folder_name || 'temp', imageName);
    }
  }

  /**
   * Normalize priorities
   * Resets all priorities based on current sort order, separated by 10
   */
  public normalizePriorities(): boolean {
    const data = this.loadProjects();
    const projects = data.projects;
    
    // Create view with indices
    const sortedProjects = projects.map((p, index) => ({ ...p, originalIndex: index }));
    
    // Apply sort (Reverse then Priority Desc)
    sortedProjects.reverse();
    sortedProjects.sort((a, b) => {
      const priorityA = (typeof a.priority !== 'undefined') ? a.priority : 1000;
      const priorityB = (typeof b.priority !== 'undefined') ? b.priority : 1000;
      return priorityB - priorityA;
    });
    
    // Assign new priorities
    // Start from high number and go down by 10s
    // Top item gets (length * 10)
    const basePriority = sortedProjects.length * 10;
    
    sortedProjects.forEach((p, index) => {
      const newPriority = basePriority - (index * 10);
      
      // Update original project
      if (data.projects[p.originalIndex]) {
        data.projects[p.originalIndex].priority = newPriority;
      }
    });
    
    this.saveProjects(data);
    return true;
  }

  /**
   * Get all projects with structure information
   */
  public getProjectsWithStructure(): (Project & { isNewStructure: boolean })[] {
    const projects = this.getAllProjects();
    return projects.map(project => ({
      ...project,
      isNewStructure: this.isNewStructure(project)
    }));
  }
}

// Export singleton instance
export const projectsService = ProjectsService.getInstance(); 