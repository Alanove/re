"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const adminMenuService_1 = require("../services/adminMenuService");
const projectsService_1 = require("../services/projectsService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const urlHelper_1 = require("../utils/urlHelper");
const constants_1 = require("../../src/constants");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const projectsService = projectsService_1.ProjectsService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const projectUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            let folderName = 'temp';
            if (req.body.title) {
                folderName = (0, urlHelper_1.TOUrl)(req.body.title);
            }
            const projectDir = (0, constants_1.getProjectDirPath)(folderName);
            if (!fs_1.default.existsSync(projectDir)) {
                fs_1.default.mkdirSync(projectDir, { recursive: true });
            }
            cb(null, projectDir);
        },
        filename: (req, file, cb) => {
            const timestamp = Date.now();
            const randomSuffix = Math.round(Math.random() * 1E9);
            const ext = path_1.default.extname(file.originalname);
            const filename = `project-${timestamp}-${randomSuffix}${ext}`;
            cb(null, filename);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
const workUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: async (req, file, cb) => {
            const projectId = req.params['projectId'];
            if (!projectId) {
                return cb(new Error('Project ID is required'), '');
            }
            try {
                const project = await projectsService.getProjectById(parseInt(projectId));
                if (project) {
                    const workFolderName = req.body.folder_name || req.body.description || 'temp';
                    const sanitizedWorkFolder = (0, urlHelper_1.TOUrl)(workFolderName);
                    const workDir = (0, constants_1.getWorkDirPath)(project.slug, sanitizedWorkFolder);
                    if (!fs_1.default.existsSync(workDir)) {
                        fs_1.default.mkdirSync(workDir, { recursive: true });
                    }
                    cb(null, workDir);
                }
                else {
                    cb(new Error('Project not found'), '');
                }
            }
            catch (error) {
                cb(new Error('Failed to get project'), '');
            }
        },
        filename: (req, file, cb) => {
            const timestamp = Date.now();
            const randomSuffix = Math.round(Math.random() * 1E9);
            const ext = path_1.default.extname(file.originalname);
            const filename = `work-${timestamp}-${randomSuffix}${ext}`;
            cb(null, filename);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
class ProjectsController {
    static async projects(req, res) {
        try {
            const dbProjects = await projectsService.getAllProjects();
            const projects = dbProjects.map((p) => ({
                id: p.id,
                title: p.title,
                folder_name: p.slug,
                url: p.slug,
                project_image: p.featuredImage,
                categories: p.tags || [],
                works: [],
                ...p
            }));
            const siteTitle = await siteSettingsService.getSiteTitle();
            const success = req.query['success'];
            const error = req.query['error'];
            const allCategories = new Set();
            projects.forEach(project => {
                if (project.categories && Array.isArray(project.categories)) {
                    project.categories.forEach((category) => {
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
        }
        catch (error) {
            console.error('Error rendering projects:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createProject(req, res) {
        try {
            const allProjects = await projectsService.getAllProjects();
            const allCategories = new Set();
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
                works: []
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
        }
        catch (error) {
            console.error('Error rendering create project:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createProjectPost(req, res) {
        try {
            projectUpload.single('projectPicture')(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    const formData = req.body || {};
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
                const { title, categories, projectImage, bau, area, size, quantity, contractor, architect, client, scope, country } = req.body || {};
                const formData = { title, project_image: projectImage, categories };
                if (!title) {
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
                const slug = (0, urlHelper_1.TOUrl)(title.trim());
                let imagePath = projectImage || '';
                const file = req.file;
                if (file && file.filename) {
                    imagePath = file.filename;
                    console.log('New project image uploaded:', imagePath);
                }
                let tagsArray = [];
                if (categories) {
                    if (typeof categories === 'string') {
                        tagsArray = categories.split(',').map((c) => c.trim()).filter((c) => c !== '');
                    }
                    else if (Array.isArray(categories)) {
                        tagsArray = categories;
                    }
                }
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
                }
                else {
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
        }
        catch (error) {
            console.error('Error creating project:', error);
            const formData = req.body || {};
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
    static async editProject(req, res) {
        try {
            const projectId = parseInt(req.params['id'] || '0');
            const dbProject = await projectsService.getProjectById(projectId);
            if (!dbProject) {
                return res.redirect('/admin/projects?error=Project not found');
            }
            const project = {
                ...dbProject,
                folder_name: dbProject.slug,
                url: dbProject.slug,
                project_image: dbProject.featuredImage,
                categories: dbProject.tags || [],
                works: []
            };
            const allProjects = await projectsService.getAllProjects();
            const allCategories = new Set();
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
        }
        catch (error) {
            console.error('Error rendering edit project:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async editProjectPost(req, res) {
        try {
            const projectId = parseInt(req.params['id'] || '0');
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
                const { title, categories, projectImage, bau, area, size, quantity, contractor, architect, client, scope, country } = req.body;
                const existingProject = await projectsService.getProjectById(projectId);
                if (!existingProject) {
                    return res.redirect('/admin/projects?error=Project not found');
                }
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
                let imagePath = projectImage || existingProject.featuredImage || '';
                const file = req.file;
                if (file && file.filename) {
                    imagePath = file.filename;
                    console.log('New project image uploaded:', imagePath);
                }
                let tagsArray = [];
                if (categories) {
                    if (typeof categories === 'string') {
                        tagsArray = categories.split(',').map((c) => c.trim()).filter((c) => c !== '');
                    }
                    else if (Array.isArray(categories)) {
                        tagsArray = categories;
                    }
                }
                const updateData = {
                    title: title.trim(),
                    slug: existingProject.slug,
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
                const updatedProject = await projectsService.updateProject(projectId, updateData);
                if (updatedProject) {
                    res.redirect('/admin/projects?success=Project updated successfully');
                }
                else {
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
        }
        catch (error) {
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
    static async deleteProjectImage(req, res) {
        try {
            const projectId = parseInt(req.params['id'] || '0');
            const existingProject = await projectsService.getProjectById(projectId);
            if (!existingProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            if (!existingProject.featuredImage) {
                return res.status(400).json({
                    success: false,
                    message: 'Project has no image to delete'
                });
            }
            const imagePath = path_1.default.join((0, constants_1.getProjectDirPath)(existingProject.slug), existingProject.featuredImage);
            if (fs_1.default.existsSync(imagePath)) {
                fs_1.default.unlinkSync(imagePath);
            }
            const updateData = {
                featuredImage: ''
            };
            const updatedProject = await projectsService.updateProject(projectId, updateData);
            if (updatedProject) {
                res.json({
                    success: true,
                    message: 'Project image deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete project image'
                });
            }
        }
        catch (error) {
            console.error('Error deleting project image:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the project image'
            });
        }
    }
    static async deleteProject(req, res) {
        try {
            const projectId = parseInt(req.params['id'] || '0');
            const existingProject = await projectsService.getProjectById(projectId);
            if (!existingProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            const deleted = await projectsService.deleteProject(projectId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Project deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete project'
                });
            }
        }
        catch (error) {
            console.error('Error deleting project:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the project'
            });
        }
    }
    static async addWorkToProject(req, res) {
        try {
            const projectId = parseInt(req.params['projectId'] || '0');
            const dbProject = await projectsService.getProjectById(projectId);
            if (!dbProject) {
                res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
                return;
            }
            const project = {
                ...dbProject,
                folder_name: dbProject.slug,
                works: []
            };
            workUpload.array('workImages', 10)(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    res.status(400).json({
                        success: false,
                        message: err.message || 'File upload error occurred.'
                    });
                    return;
                }
                const { description, folder_name, categories, scope_of_work, 'details[project]': projectName, 'details[architect]': architect, 'details[location]': location, 'details[year]': year } = req.body;
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
                if (!description || description.trim() === '') {
                    res.status(400).json({
                        success: false,
                        message: 'Work description is required.'
                    });
                    return;
                }
                const finalFolderName = folder_name || (0, urlHelper_1.TOUrl)(description.trim());
                const uploadedImages = [];
                if (req.files && Array.isArray(req.files)) {
                    for (const file of req.files) {
                        if (file.filename) {
                            uploadedImages.push(file.filename);
                            console.log('Work image uploaded:', file.filename);
                        }
                    }
                }
                const workData = {
                    description: description.trim(),
                    folder_name: finalFolderName,
                    categories: (typeof categories === 'string' && categories) ? categories.split(',').map((cat) => cat.trim()).filter((cat) => cat !== '') : [],
                    scope_of_work: (typeof scope_of_work === 'string' && scope_of_work) ? scope_of_work.split('\n').filter((line) => line.trim() !== '') : [],
                    images: uploadedImages,
                    details: {
                        project: projectName || '',
                        architect: architect || '',
                        location: location || '',
                        year: year || ''
                    }
                };
                console.log('Work data to add:', workData);
                const newWork = await projectsService.addWorkToProject(projectId, workData);
                console.log('Result from addWorkToProject:', newWork);
                if (newWork) {
                    console.log('Work added successfully, sending response');
                    res.json({
                        success: true,
                        message: `Work added successfully with ${uploadedImages.length} image(s)`,
                        work: newWork
                    });
                }
                else {
                    console.log('Failed to add work, sending error response');
                    res.status(500).json({
                        success: false,
                        message: 'Failed to add work'
                    });
                }
            });
        }
        catch (error) {
            console.error('Error adding work to project:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while adding work'
            });
        }
    }
    static async updateWorkInProject(req, res) {
        try {
            const projectId = parseInt(req.params['projectId'] || '0');
            const workId = parseInt(req.params['workId'] || '0');
            const dbProject = await projectsService.getProjectById(projectId);
            if (!dbProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            const project = {
                ...dbProject,
                folder_name: dbProject.slug,
                works: []
            };
            workUpload.array('workImages', 10)(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    return res.status(400).json({
                        success: false,
                        message: err.message || 'File upload error occurred.'
                    });
                }
                try {
                    return res.status(501).json({
                        success: false,
                        message: 'Works feature not implemented yet. Requires database migration.'
                    });
                }
                catch (error) {
                    console.error('Error processing work update:', error);
                    res.status(500).json({
                        success: false,
                        message: 'An error occurred while updating work'
                    });
                }
            });
        }
        catch (error) {
            console.error('Error updating work in project:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while updating work'
            });
        }
    }
    static async deleteWorkImage(req, res) {
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
            const dbProject = await projectsService.getProjectById(projectId);
            if (!dbProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            const project = {
                ...dbProject,
                folder_name: dbProject.slug,
                works: []
            };
            return res.status(501).json({
                success: false,
                message: 'Work image deletion not implemented yet. Works feature requires database migration.'
            });
        }
        catch (error) {
            console.error('Error deleting work image:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting image'
            });
        }
    }
    static async deleteWorkFromProject(req, res) {
        try {
            const projectId = parseInt(req.params['projectId'] || '0');
            const workId = parseInt(req.params['workId'] || '0');
            const dbProject = await projectsService.getProjectById(projectId);
            if (!dbProject) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            const project = {
                ...dbProject,
                folder_name: dbProject.slug,
                works: []
            };
            const deleted = await projectsService.deleteWorkFromProject(projectId, workId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Work deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete work'
                });
            }
        }
        catch (error) {
            console.error('Error deleting work from project:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting work'
            });
        }
    }
}
exports.ProjectsController = ProjectsController;
//# sourceMappingURL=projectsController.js.map