import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { AdminMenuService } from '../services/adminMenuService';
import { ProjectsService } from '../services/projectsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { TOUrl } from '../utils/urlHelper';
import { getWorkDirPath, getProjectDirPath } from '../../src/constants';

const menuService = AdminMenuService.getInstance();
const projectsService = ProjectsService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

// Create multer configuration for project uploads
const projectUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Get project folder name from title using TOUrl function
      let folderName = 'temp';
      if (req.body.title) {
        folderName = TOUrl(req.body.title);
      }
      
      // Create project-specific directory
      const projectDir = getProjectDirPath(folderName);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      cb(null, projectDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const filename = `project-${timestamp}-${randomSuffix}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create multer configuration for work uploads
const workUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Get project ID from URL params
      const projectId = req.params['projectId'];
      if (!projectId) {
        return cb(new Error('Project ID is required'), '');
      }
      
      const project = projectsService.getProjectById(parseInt(projectId));
      
      if (project) {
        // Get work folder name from form data or generate from description
        const workFolderName = req.body.folder_name || req.body.description || 'temp';
        const sanitizedWorkFolder = TOUrl(workFolderName);
        
        // Create work-specific directory within project folder
        const workDir = getWorkDirPath(project.folder_name, sanitizedWorkFolder);
        if (!fs.existsSync(workDir)) {
          fs.mkdirSync(workDir, { recursive: true });
        }
        cb(null, workDir);
      } else {
        cb(new Error('Project not found'), '');
      }
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const filename = `work-${timestamp}-${randomSuffix}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export class ProjectsController {
  /**
   * Render projects management page
   */
  public static async projects(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/projects');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get projects from the projects service
      const projects = projectsService.getAllProjects();
      
      // Map projects to include original index
      const projectsWithIndex = projects.map((p, index) => ({ ...p, originalIndex: index }));
      
      // Sort projects by priority (Desc) then by Date (Newest first)
      // First reverse to get Newest first (assuming array is append-only)
      projectsWithIndex.reverse();
      
      // Then stable sort by priority
      projectsWithIndex.sort((a, b) => {
        const priorityA = (typeof a.priority !== 'undefined') ? a.priority : 1000;
        const priorityB = (typeof b.priority !== 'undefined') ? b.priority : 1000;
        return priorityB - priorityA;
      });
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get success/error messages from query params
      const success = req.query['success'] as string;
      const error = req.query['error'] as string;
      
      // Get all unique categories from projects
      const allCategories = new Set<string>();
      projects.forEach(project => {
        if (project.categories && Array.isArray(project.categories)) {
          project.categories.forEach(category => {
            if (category && category.trim()) {
              allCategories.add(category.trim());
            }
          });
        }
      });
      const sortedCategories = Array.from(allCategories).sort();
      
      res.render('projects/projects', {
        title: 'Projects Management',
        pageTitle: 'Projects Management',
        pageSubtitle: 'Manage your portfolio projects and works',
        projects: projectsWithIndex,
        categories: sortedCategories,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        projectsService: projectsService
      });
    } catch (error) {
      console.error('Error rendering projects:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create project page
   */
  public static async createProject(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/projects');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get all available categories
      const categories = projectsService.getAllCategories();
      
      // Create empty project object for create mode
      const emptyProject = {
        title: '',
        folder_name: '',
        project_image: '',
        categories: [],
        works: [],
        url: ''
      };
      
      res.render('projects/edit-project', {
        title: 'Create Project',
        pageTitle: 'Create Project',
        pageSubtitle: 'Add a new project to your portfolio',
        project: emptyProject,
        projectId: '',
        categories: categories,
        isCreateMode: true,
        projectsService: projectsService
      });
    } catch (error) {
      console.error('Error rendering create project:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create project form submission
   */
  public static async createProjectPost(req: Request, res: Response): Promise<void> {
    try {
      // Use multer to handle file uploads
      projectUpload.single('projectPicture')(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const formData = req.body || {};
          
          // Create a complete project object with form data and defaults
          const projectData = {
            title: formData.title || '',
            project_image: formData.project_image || '',
            categories: formData.categories || [],
            works: [],
            url: ''
          };
          
          res.render('projects/edit-project', {
            title: 'Create Project',
            pageTitle: 'Create Project',
            pageSubtitle: 'Add a new project to your portfolio',
            project: projectData,
            projectId: '',
            categories: projectsService.getAllCategories(),
            isCreateMode: true,
            error: err.message || 'File upload error occurred.'
          });
          return;
        }

        const { 
          title, 
          categories, 
          projectImage,
          bau,
          area,
          size,
          quantity,
          contractor,
          architect,
          client,
          scope,
          country,
          mapLocation,
          land,
          capacity,
          districts,
          owner,
          consultant,
          all_text,
          priority
        } = req.body || {};
        
        // Prepare form data for potential re-render
        const formData = { title, project_image: projectImage, categories };
        
        // Validation
        if (!title) {
          // Create a complete project object with form data and defaults
          const projectData = {
            title: formData.title || '',
            project_image: formData.project_image || '',
            categories: formData.categories || [],
            works: [],
            url: ''
          };
          
          return res.render('projects/edit-project', {
            title: 'Create Project',
            pageTitle: 'Create Project',
            pageSubtitle: 'Add a new project to your portfolio',
            project: projectData,
            projectId: '',
            categories: projectsService.getAllCategories(),
            isCreateMode: true,
            error: 'Project title is required.'
          });
        }
        
        // Generate folder name from title
        const folder_name = TOUrl(title.trim());
        
        // Handle uploaded file
        let imagePath = projectImage || '';
        const file = req.file;
        if (file && file.filename) {
          imagePath = file.filename;
          console.log('New project image uploaded:', imagePath);
        }
        
        // Create new project
        const newProject = projectsService.createProject({
          title: title.trim(),
          folder_name: folder_name,
          project_image: imagePath,
          categories: categories ? (Array.isArray(categories) ? categories : [categories]) : [],
          works: [],
          // Include all project details
          bau: bau || '',
          area: area || '',
          size: size || '',
          quantity: quantity || '',
          contractor: contractor || '',
          architect: architect || '',
          client: client || '',
          scope: scope || '',
          country: country || '',
          mapLocation: mapLocation || '',
          land: land || '',
          capacity: capacity || '',
          districts: districts || '',
          owner: owner || '',
          consultant: consultant || '',
          all_text: all_text || '',
          priority: priority ? parseInt(priority.toString()) : 1000
        });
        
        if (newProject) {
          res.redirect('/admin/projects?success=Project created successfully');
        } else {
          // Create a complete project object with form data and defaults
          const projectData = {
            title: formData.title || '',
            project_image: formData.project_image || '',
            categories: formData.categories || [],
            works: [],
            url: ''
          };
          
          res.render('projects/edit-project', {
            title: 'Create Project',
            pageTitle: 'Create Project',
            pageSubtitle: 'Add a new project to your portfolio',
            project: projectData,
            projectId: '',
            categories: projectsService.getAllCategories(),
            isCreateMode: true,
            error: 'Failed to create project. Please try again.'
          });
        }
      });
    } catch (error) {
      console.error('Error creating project:', error);
      const formData = req.body || {};
      
      // Create a complete project object with form data and defaults
      const projectData = {
        title: formData.title || '',
        project_image: formData.project_image || '',
        categories: formData.categories || [],
        works: [],
        url: ''
      };
      
      res.render('projects/edit-project', {
        title: 'Create Project',
        pageTitle: 'Create Project',
        pageSubtitle: 'Add a new project to your portfolio',
        project: projectData,
        projectId: '',
        categories: projectsService.getAllCategories(),
        isCreateMode: true,
        error: 'An error occurred while creating the project.'
      });
    }
  }

  /**
   * Render edit project page
   */
  public static async editProject(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/projects');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      const projectId = parseInt(req.params['id'] || '0');
      const project = projectsService.getProjectById(projectId);
      
      if (!project) {
        return res.redirect('/admin/projects?error=Project not found');
      }
      
      // Get all available categories
      const categories = projectsService.getAllCategories();
      
      res.render('projects/edit-project', {
        title: 'Edit Project',
        pageTitle: 'Edit Project',
        pageSubtitle: 'Update project information and works',
        project: project,
        projectId: projectId,
        categories: categories,
        isCreateMode: false,
        projectsService: projectsService
      });
    } catch (error) {
      console.error('Error rendering edit project:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit project form submission
   */
  public static async editProjectPost(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params['id'] || '0');
      
      // Use multer to handle file uploads
      projectUpload.single('projectPicture')(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          const existingProject = projectsService.getProjectById(projectId);
          res.render('projects/edit-project', {
            title: 'Edit Project',
            pageTitle: 'Edit Project',
            pageSubtitle: 'Update project information and works',
            project: existingProject,
            projectId: projectId,
            categories: projectsService.getAllCategories(),
            isCreateMode: false,
            error: err.message || 'File upload error occurred.'
          });
          return;
        }

        const { 
          title, 
          categories, 
          projectImage,
          bau,
          area,
          size,
          quantity,
          contractor,
          architect,
          client,
          scope,
          country,
          mapLocation,
          land,
          capacity,
          districts,
          owner,
          consultant,
          all_text,
          priority
        } = req.body;
        
        // Get existing project
        const existingProject = projectsService.getProjectById(projectId);
        if (!existingProject) {
          return res.redirect('/admin/projects?error=Project not found');
        }
        
        // Validation
        if (!title || title.trim() === '') {
                  return res.render('projects/edit-project', {
          title: 'Edit Project',
          pageTitle: 'Edit Project',
          pageSubtitle: 'Update project information and works',
          project: existingProject,
          projectId: projectId,
          categories: projectsService.getAllCategories(),
          isCreateMode: false,
          error: 'Project title is required.'
        });
        }
        
        // Handle uploaded file
        let imagePath = projectImage || existingProject.project_image || '';
        const file = req.file;
        if (file && file.filename) {
          // Generate project URL from title
          const projectUrl = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
          
          imagePath = file.filename;
          console.log('New project image uploaded:', imagePath);
        }
        
        // Prepare update data
        // Use explicit undefined checks to allow empty strings to be saved
        const updateData = {
          title: title.trim(),
          folder_name: existingProject.folder_name, // Keep existing folder name
          project_image: imagePath,
          categories: (typeof categories === 'string' && categories) ? categories.split(',').map((cat: string) => cat.trim()).filter((cat: string) => cat !== '') : [],
          works: existingProject.works || [],
          // Preserve all project details - allow empty strings to be saved
          bau: bau !== undefined ? bau : (existingProject.bau ?? ''),
          area: area !== undefined ? area : (existingProject.area ?? ''),
          size: size !== undefined ? size : (existingProject.size ?? ''),
          quantity: quantity !== undefined ? quantity : (existingProject.quantity ?? ''),
          contractor: contractor !== undefined ? contractor : (existingProject.contractor ?? ''),
          architect: architect !== undefined ? architect : (existingProject.architect ?? ''),
          client: client !== undefined ? client : (existingProject.client ?? ''),
          scope: scope !== undefined ? scope : (existingProject.scope ?? ''),
          country: country !== undefined ? country : (existingProject.country ?? ''),
          mapLocation: mapLocation !== undefined ? mapLocation : (existingProject.mapLocation ?? ''),
          land: land !== undefined ? land : (existingProject.land ?? ''),
          capacity: capacity !== undefined ? capacity : (existingProject.capacity ?? ''),
          districts: districts !== undefined ? districts : (existingProject.districts ?? ''),
          owner: owner !== undefined ? owner : (existingProject.owner ?? ''),
          consultant: consultant !== undefined ? consultant : (existingProject.consultant ?? ''),
          all_text: all_text !== undefined ? all_text : (existingProject.all_text ?? ''),
          priority: priority !== undefined ? parseInt(priority.toString()) : (existingProject.priority ?? 1000)
        };
        
        // Update project
        const updatedProject = projectsService.updateProject(projectId, updateData);
        
        if (updatedProject) {
          res.redirect('/admin/projects?success=Project updated successfully');
        } else {
                  res.render('projects/edit-project', {
          title: 'Edit Project',
          pageTitle: 'Edit Project',
          pageSubtitle: 'Update project information and works',
          project: existingProject,
          projectId: projectId,
          categories: projectsService.getAllCategories(),
          isCreateMode: false,
          error: 'Failed to update project. Please try again.'
        });
        }
      });
    } catch (error) {
      console.error('Error updating project:', error);
      const projectId = parseInt(req.params['id'] || '0');
      const existingProject = projectsService.getProjectById(projectId);
      
      res.render('projects/edit-project', {
        title: 'Edit Project',
        pageTitle: 'Edit Project',
        pageSubtitle: 'Update project information and works',
        project: existingProject || {},
        projectId: projectId,
        categories: projectsService.getAllCategories(),
        isCreateMode: false,
        error: 'An error occurred while updating the project.'
      });
    }
  }

  /**
   * Delete project image
   */
  public static async deleteProjectImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const projectId = parseInt(req.params['id'] || '0');
      
      // Check if project exists
      const existingProject = projectsService.getProjectById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if project has an image
      if (!existingProject.project_image) {
        return res.status(400).json({
          success: false,
          message: 'Project has no image to delete'
        });
      }
      
      // Delete the image file from the filesystem
      const imagePath = path.join(getProjectDirPath(existingProject.folder_name), existingProject.project_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      // Update project to remove image reference
      const updateData = {
        ...existingProject,
        project_image: ''
      };
      
      const updatedProject = projectsService.updateProject(projectId, updateData);
      
      if (updatedProject) {
        res.json({
          success: true,
          message: 'Project image deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete project image'
        });
      }
    } catch (error) {
      console.error('Error deleting project image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the project image'
      });
    }
  }

  /**
   * Delete project
   */
  public static async deleteProject(req: Request, res: Response): Promise<Response | void> {
    try {
      const projectId = parseInt(req.params['id'] || '0');
      
      // Check if project exists
      const existingProject = projectsService.getProjectById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Delete project
      const deleted = projectsService.deleteProject(projectId);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Project deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete project'
        });
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the project'
      });
    }
  }

  /**
   * Move project up
   */
  public static async moveProjectUp(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params['id'] || '0');
      
      const success = projectsService.moveProject(projectId, 'up');
      
      if (success) {
        res.redirect('/admin/projects?success=Project moved up successfully');
      } else {
        res.redirect('/admin/projects?error=Failed to move project up');
      }
    } catch (error) {
      console.error('Error moving project up:', error);
      res.redirect('/admin/projects?error=An error occurred while moving the project');
    }
  }

  /**
   * Move project down
   */
  public static async moveProjectDown(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params['id'] || '0');
      
      const success = projectsService.moveProject(projectId, 'down');
      
      if (success) {
        res.redirect('/admin/projects?success=Project moved down successfully');
      } else {
        res.redirect('/admin/projects?error=Failed to move project down');
      }
    } catch (error) {
      console.error('Error moving project down:', error);
      res.redirect('/admin/projects?error=An error occurred while moving the project');
    }
  }

  /**
   * Normalize priorities (Reset to intervals of 10)
   */
  public static async normalizePriorities(req: Request, res: Response): Promise<void> {
    try {
      const success = projectsService.normalizePriorities();
      
      if (success) {
        res.redirect('/admin/projects?success=Priorities reset successfully');
      } else {
        res.redirect('/admin/projects?error=Failed to reset priorities');
      }
    } catch (error) {
      console.error('Error normalizing priorities:', error);
      res.redirect('/admin/projects?error=An error occurred while resetting priorities');
    }
  }

  /**
   * Add work to project
   */
  public static async addWorkToProject(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params['projectId'] || '0');
      
      // Check if project exists
      const project = projectsService.getProjectById(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      // Use multer to handle file uploads
      workUpload.array('workImages', 10)(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          res.status(400).json({
            success: false,
            message: err.message || 'File upload error occurred.'
          });
          return;
        }

        // Extract work data from form
        const {
          description,
          folder_name,
          categories,
          scope_of_work,
          'details[project]': projectName,
          'details[architect]': architect,
          'details[location]': location,
          'details[year]': year
        } = req.body;

        console.log('Received form data:', {
          description,
          folder_name,
          categories,
          scope_of_work,
          projectName,
          architect,
          location,
          year
        });
        console.log('Files uploaded:', req.files);

        // Validation
        if (!description || description.trim() === '') {
          res.status(400).json({
            success: false,
            message: 'Work description is required.'
          });
          return;
        }

        const finalFolderName = folder_name || TOUrl(description.trim());
        
        // Handle uploaded files
        const uploadedImages: string[] = [];
        if (req.files && Array.isArray(req.files)) {
          for (const file of req.files) {
            if (file.filename) {
              uploadedImages.push(file.filename);
              console.log('Work image uploaded:', file.filename);
            }
          }
        }
        
        // Prepare work data
        const workData = {
          description: description.trim(),
          folder_name: finalFolderName,
          categories: (typeof categories === 'string' && categories) ? categories.split(',').map((cat: string) => cat.trim()).filter((cat: string) => cat !== '') : [],
          scope_of_work: (typeof scope_of_work === 'string' && scope_of_work) ? scope_of_work.split('\n').filter((line: string) => line.trim() !== '') : [],
          images: uploadedImages,
          details: {
            project: projectName || '',
            architect: architect || '',
            location: location || '',
            year: year || ''
          }
        };

        console.log('Work data to add:', workData);
        
        // Add work to project
        const newWork = projectsService.addWorkToProject(projectId, workData);
        console.log('Result from addWorkToProject:', newWork);
        
        if (newWork) {
          console.log('Work added successfully, sending response');
          res.json({
            success: true,
            message: `Work added successfully with ${uploadedImages.length} image(s)`,
            work: newWork
          });
        } else {
          console.log('Failed to add work, sending error response');
          res.status(500).json({
            success: false,
            message: 'Failed to add work'
          });
        }
      });
    } catch (error) {
      console.error('Error adding work to project:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while adding work'
      });
    }
  }

  /**
   * Update work in project
   */
  public static async updateWorkInProject(req: Request, res: Response): Promise<any> {
    try {
      const projectId = parseInt(req.params['projectId'] || '0');
      const workId = parseInt(req.params['workId'] || '0');
      
      // Check if project exists
      const project = projectsService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Use multer to handle file uploads
      workUpload.array('workImages', 10)(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          return res.status(400).json({
            success: false,
            message: err.message || 'File upload error occurred.'
          });
        }

        try {
          const { description, folder_name, categories, details, scope_of_work } = req.body;

          // Get existing work
          const existingWork = project.works[workId];
          if (!existingWork) {
            return res.status(404).json({
              success: false,
              message: 'Work not found'
            });
          }

          // Get uploaded files
          const uploadedFiles = req.files as Express.Multer.File[];
          const newImageNames: string[] = [];

          if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
              newImageNames.push(file.filename);
            });
          }

          // Prepare work data
          const workData = {
            description: description || existingWork.description,
            folder_name: folder_name || existingWork.folder_name,
            categories: categories ? categories.split(',').map((cat: string) => cat.trim()) : existingWork.categories,
            details: {
              project: details?.project || existingWork.details?.project,
              client: details?.client || existingWork.details?.client,
              architect: details?.architect || existingWork.details?.architect,
              developer: details?.developer || existingWork.details?.developer,
              contractor: details?.contractor || existingWork.details?.contractor,
              location: details?.location || existingWork.details?.location,
              year: details?.year || existingWork.details?.year
            },
            scope_of_work: scope_of_work ? scope_of_work.split('\n').filter((item: string) => item.trim()) : existingWork.scope_of_work,
            images: [
              ...(existingWork.images || []),
              ...newImageNames
            ]
          };

          // Update work in project
          const updatedWork = projectsService.updateWorkInProject(projectId, workId, workData);
          
          if (updatedWork) {
            res.json({
              success: true,
              message: 'Work updated successfully',
              work: updatedWork
            });
          } else {
            res.status(500).json({
              success: false,
              message: 'Failed to update work'
            });
          }
        } catch (error) {
          console.error('Error processing work update:', error);
          res.status(500).json({
            success: false,
            message: 'An error occurred while updating work'
          });
        }
      });
    } catch (error) {
      console.error('Error updating work in project:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating work'
      });
    }
  }

  /**
   * Delete work image
   */
  public static async deleteWorkImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const projectId = parseInt(req.params['projectId'] || '0');
      const workId = parseInt(req.params['workId'] || '0');
      const imageName = req.params['imageName'];
      
      if (!imageName) {
        return res.status(400).json({
          success: false,
          message: 'Image name is required'
        });
      }
      
      // Check if project exists
      const project = projectsService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if work exists
      const work = project.works[workId];
      if (!work) {
        return res.status(404).json({
          success: false,
          message: 'Work not found'
        });
      }
      
      // Check if image exists in work
      if (!work.images || !work.images.includes(imageName)) {
        return res.status(404).json({
          success: false,
          message: 'Image not found in work'
        });
      }
      
      // Delete image from file system
      const workDir = getWorkDirPath(project.folder_name, work.folder_name);
      const imagePath = path.join(workDir, imageName);
      
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Deleted image: ${imagePath}`);
      }
      
      // Remove image from work data
      work.images = work.images.filter(img => img !== imageName);
      
      // Save updated project data
      const data = projectsService.loadProjects();
      // Update the project in the loaded data
      data.projects[projectId] = project;
      projectsService.saveProjects(data);
      
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting work image:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting image'
      });
    }
  }

  /**
   * Delete work from project
   */
  public static async deleteWorkFromProject(req: Request, res: Response): Promise<Response | void> {
    try {
      const projectId = parseInt(req.params['projectId'] || '0');
      const workId = parseInt(req.params['workId'] || '0');
      
      // Check if project exists
      const project = projectsService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Delete work from project
      const deleted = projectsService.deleteWorkFromProject(projectId, workId);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Work deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete work'
        });
      }
    } catch (error) {
      console.error('Error deleting work from project:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting work'
      });
    }
  }
} 