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
    destination: async (req, file, cb) => {
      // Get project ID from URL params
      const projectId = req.params['projectId'];
      if (!projectId) {
        return cb(new Error('Project ID is required'), '');
      }
      
      try {
        const project = await projectsService.getProjectById(parseInt(projectId));
        if (project) {
          // Get work folder name from form data or generate from description
          const workFolderName = req.body.folder_name || req.body.description || 'temp';
          const sanitizedWorkFolder = TOUrl(workFolderName);
          
          // Create work-specific directory within project folder
          const workDir = getWorkDirPath(project.slug, sanitizedWorkFolder);
          if (!fs.existsSync(workDir)) {
            fs.mkdirSync(workDir, { recursive: true });
          }
          cb(null, workDir);
        } else {
          cb(new Error('Project not found'), '');
        }
      } catch (error) {
        cb(new Error('Failed to get project'), '');
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
      // Get projects from the projects service
      const dbProjects = await projectsService.getAllProjects();
      
      // Transform database projects to match view expectations
      const projects = dbProjects.map((p: any) => ({
        id: p.id,
        title: p.title,
        folder_name: p.slug,
        url: p.slug,
        project_image: p.featuredImage,
        categories: p.tags || [],
        works: [], // TODO: Add works when implemented
        ...p
      }));
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get success/error messages from query params
      const success = req.query['success'] as string;
      const error = req.query['error'] as string;
      
      // Get all unique categories from projects
      const allCategories = new Set<string>();
      projects.forEach(project => {
        if (project.categories && Array.isArray(project.categories)) {
          project.categories.forEach((category: string) => {
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
        projects: projects,
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
      // Get all available categories
      const allProjects = await projectsService.getAllProjects();
      const allCategories = new Set<string>();
      allProjects.forEach(project => {
        if (project.tags && Array.isArray(project.tags)) {
          project.tags.forEach(tag => {
            if (tag && tag.trim()) {
              allCategories.add(tag.trim());
            }
          });
        }
      });
      const categories = Array.from(allCategories).sort();
      
      // Create empty project object for create mode
      const emptyProject = {
        title: '',
        slug: '',
        description: '',
        content: '',
        featuredImage: '',
        images: [],
        tags: [],
        status: 'published',
        orderIndex: 0,
        works: [] // Required by the view template
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
            categories: await projectsService.getAllCategories(),
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
          country
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
            categories: await projectsService.getAllCategories(),
            isCreateMode: true,
            error: 'Project title is required.'
          });
        }
        
        // Generate slug from title
        const slug = TOUrl(title.trim());
        
        // Handle uploaded file
        let imagePath = projectImage || '';
        const file = req.file;
        if (file && file.filename) {
          imagePath = file.filename;
          console.log('New project image uploaded:', imagePath);
        }
        
        // Parse categories (could be comma-separated string or array)
        let tagsArray: string[] = [];
        if (categories) {
          if (typeof categories === 'string') {
            tagsArray = categories.split(',').map((c: string) => c.trim()).filter((c: string) => c !== '');
          } else if (Array.isArray(categories)) {
            tagsArray = categories;
          }
        }
        
        // Create new project with MySQL schema
        const newProject = await projectsService.createProject({
          title: title.trim(),
          slug: slug,
          description: '',
          content: '',
          country: country || '',
          city: '',
          year: null,
          category: '',
          client: client || '',
          featuredImage: imagePath,
          images: [],
          tags: tagsArray,
          status: 'published',
          orderIndex: 0
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
            categories: await projectsService.getAllCategories(),
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
        categories: await projectsService.getAllCategories(),
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
      const projectId = parseInt(req.params['id'] || '0');
      const dbProject = await projectsService.getProjectById(projectId);
      
      if (!dbProject) {
        return res.redirect('/admin/projects?error=Project not found');
      }
      
      // Transform to match view expectations
      const project = {
        ...dbProject,
        folder_name: dbProject.slug,
        url: dbProject.slug,
        project_image: dbProject.featuredImage,
        categories: dbProject.tags || [],
        works: [] // TODO: Implement works as separate table
      };
      
      // Get all available categories
      const allProjects = await projectsService.getAllProjects();
      const allCategories = new Set<string>();
      allProjects.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
          p.tags.forEach(tag => {
            if (tag && tag.trim()) {
              allCategories.add(tag.trim());
            }
          });
        }
      });
      const categories = Array.from(allCategories).sort();
      
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
          const existingProject = await projectsService.getProjectById(projectId);
          res.render('projects/edit-project', {
            title: 'Edit Project',
            pageTitle: 'Edit Project',
            pageSubtitle: 'Update project information and works',
            project: existingProject,
            projectId: projectId,
            categories: await projectsService.getAllCategories(),
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
          country
        } = req.body;
        
        // Get existing project
        const existingProject = await projectsService.getProjectById(projectId);
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
          categories: await projectsService.getAllCategories(),
          isCreateMode: false,
          error: 'Project title is required.'
        });
        }
        
        // Handle uploaded file
        let imagePath = projectImage || existingProject.featuredImage || '';
        const file = req.file;
        if (file && file.filename) {
          imagePath = file.filename;
          console.log('New project image uploaded:', imagePath);
        }
        
        // Parse categories (could be comma-separated string or array)
        let tagsArray: string[] = [];
        if (categories) {
          if (typeof categories === 'string') {
            tagsArray = categories.split(',').map((c: string) => c.trim()).filter((c: string) => c !== '');
          } else if (Array.isArray(categories)) {
            tagsArray = categories;
          }
        }
        
        // Prepare update data with MySQL schema
        const updateData = {
          title: title.trim(),
          slug: existingProject.slug, // Keep existing slug
          description: existingProject.description || '',
          content: existingProject.content || '',
          featuredImage: imagePath,
          images: existingProject.images || [],
          tags: tagsArray,
          country: country || existingProject.country || '',
          city: existingProject.city || '',
          year: existingProject.year || null,
          category: existingProject.category || '',
          client: client || existingProject.client || '',
          status: existingProject.status || 'published',
          orderIndex: existingProject.orderIndex || 0
        };
        
        // Update project
        const updatedProject = await projectsService.updateProject(projectId, updateData);
        
        if (updatedProject) {
          res.redirect('/admin/projects?success=Project updated successfully');
        } else {
                  res.render('projects/edit-project', {
          title: 'Edit Project',
          pageTitle: 'Edit Project',
          pageSubtitle: 'Update project information and works',
          project: existingProject,
          projectId: projectId,
          categories: await projectsService.getAllCategories(),
          isCreateMode: false,
          error: 'Failed to update project. Please try again.'
        });
        }
      });
    } catch (error) {
      console.error('Error updating project:', error);
      const projectId = parseInt(req.params['id'] || '0');
      const existingProject = await projectsService.getProjectById(projectId);
      
      res.render('projects/edit-project', {
        title: 'Edit Project',
        pageTitle: 'Edit Project',
        pageSubtitle: 'Update project information and works',
        project: existingProject || {},
        projectId: projectId,
        categories: await projectsService.getAllCategories(),
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
      const existingProject = await projectsService.getProjectById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if project has an image
      if (!existingProject.featuredImage) {
        return res.status(400).json({
          success: false,
          message: 'Project has no image to delete'
        });
      }
      
      // Delete the image file from the filesystem
      const imagePath = path.join(getProjectDirPath(existingProject.slug), existingProject.featuredImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      // Update project to remove image reference
      const updateData = {
        featuredImage: ''
      };
      const updatedProject = await projectsService.updateProject(projectId, updateData);
      
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
      const existingProject = await projectsService.getProjectById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Delete project
      const deleted = await projectsService.deleteProject(projectId);
      
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
   * Add work to project
   */
  public static async addWorkToProject(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params['projectId'] || '0');
      
      // Check if project exists
      const dbProject = await projectsService.getProjectById(projectId);
      if (!dbProject) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }
      
      // Transform to include works array
      const project = {
        ...dbProject,
        folder_name: dbProject.slug,
        works: [] // TODO: Implement works as separate table
      };

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
        const newWork = await projectsService.addWorkToProject(projectId, workData);
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
      const dbProject = await projectsService.getProjectById(projectId);
      if (!dbProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Transform to include works array
      const project = {
        ...dbProject,
        folder_name: dbProject.slug,
        works: [] // TODO: Implement works as separate table
      };

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
          // TODO: Works feature not implemented yet
          return res.status(501).json({
            success: false,
            message: 'Works feature not implemented yet. Requires database migration.'
          });
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
      const dbProject = await projectsService.getProjectById(projectId);
      if (!dbProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Transform to include works array
      const project = {
        ...dbProject,
        folder_name: dbProject.slug,
        works: [] // TODO: Implement works as separate table
      };
      
      // TODO: Works feature not implemented yet
      return res.status(501).json({
        success: false,
        message: 'Work image deletion not implemented yet. Works feature requires database migration.'
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
      const dbProject = await projectsService.getProjectById(projectId);
      if (!dbProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Transform to include works array
      const project = {
        ...dbProject,
        folder_name: dbProject.slug,
        works: [] // TODO: Implement works as separate table
      };
      
      // Delete work from project
      const deleted = await projectsService.deleteWorkFromProject(projectId, workId);
      
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