"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPhotosController = void 0;
const projectPhotosService_1 = __importDefault(require("../services/projectPhotosService"));
class ProjectPhotosController {
    async getAllProjectPhotos(req, res) {
        try {
            const data = projectPhotosService_1.default.getProjectPhotos();
            res.json({
                success: true,
                data: data
            });
        }
        catch (error) {
            console.error('Error getting project photos:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get project photos data'
            });
        }
    }
    async getCategories(req, res) {
        try {
            const categories = projectPhotosService_1.default.getCategories();
            res.json({
                success: true,
                data: categories
            });
        }
        catch (error) {
            console.error('Error getting categories:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get categories'
            });
        }
    }
    async getProjectsByCategory(req, res) {
        try {
            const { category } = req.params;
            const projects = projectPhotosService_1.default.getProjectsByCategory(category);
            if (projects.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No projects found for category: ${category}`
                });
            }
            res.json({
                success: true,
                data: {
                    category,
                    projects,
                    count: projects.length
                }
            });
        }
        catch (error) {
            console.error('Error getting projects by category:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get projects by category'
            });
        }
    }
    async getProjectsByCategorySlug(req, res) {
        try {
            const { categorySlug } = req.params;
            const projects = projectPhotosService_1.default.getProjectsByCategorySlug(categorySlug);
            if (projects.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No projects found for category slug: ${categorySlug}`
                });
            }
            const category = projectPhotosService_1.default.getCategoryBySlug(categorySlug);
            res.json({
                success: true,
                data: {
                    category: category?.name || categorySlug,
                    categorySlug,
                    projects,
                    count: projects.length
                }
            });
        }
        catch (error) {
            console.error('Error getting projects by category slug:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get projects by category slug'
            });
        }
    }
    async getProjectBySlugs(req, res) {
        try {
            const { categorySlug, projectSlug } = req.params;
            const project = projectPhotosService_1.default.getProjectBySlug(categorySlug, projectSlug);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: `Project not found: ${categorySlug}/${projectSlug}`
                });
            }
            res.json({
                success: true,
                data: project
            });
        }
        catch (error) {
            console.error('Error getting project by slugs:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get project'
            });
        }
    }
    async searchProjects(req, res) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Search query parameter "q" is required'
                });
            }
            const results = projectPhotosService_1.default.searchProjects(q);
            res.json({
                success: true,
                data: {
                    query: q,
                    results,
                    count: results.length
                }
            });
        }
        catch (error) {
            console.error('Error searching projects:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to search projects'
            });
        }
    }
    async getProjectsByExtension(req, res) {
        try {
            const { extension } = req.params;
            const projects = projectPhotosService_1.default.getProjectsByExtension(extension);
            res.json({
                success: true,
                data: {
                    extension,
                    projects,
                    count: projects.length
                }
            });
        }
        catch (error) {
            console.error('Error getting projects by extension:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get projects by extension'
            });
        }
    }
    async getStatistics(req, res) {
        try {
            const stats = projectPhotosService_1.default.getStatistics();
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            console.error('Error getting statistics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get statistics'
            });
        }
    }
    async getCategoryBySlug(req, res) {
        try {
            const { categorySlug } = req.params;
            const category = projectPhotosService_1.default.getCategoryBySlug(categorySlug);
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: `Category not found: ${categorySlug}`
                });
            }
            res.json({
                success: true,
                data: category
            });
        }
        catch (error) {
            console.error('Error getting category by slug:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get category'
            });
        }
    }
}
exports.ProjectPhotosController = ProjectPhotosController;
exports.default = new ProjectPhotosController();
//# sourceMappingURL=projectPhotosController.js.map