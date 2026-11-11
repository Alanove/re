import { Request, Response } from 'express';
import projectPhotosService from '../services/projectPhotosService';

export class ProjectPhotosController {
  /**
   * Get all project photos data
   */
  async getAllProjectPhotos(req: Request, res: Response) {
    try {
      const data = projectPhotosService.getProjectPhotos();
      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('Error getting project photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get project photos data'
      });
    }
  }

  /**
   * Get all categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const categories = projectPhotosService.getCategories();
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get categories'
      });
    }
  }

  /**
   * Get projects by category
   */
  async getProjectsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const projects = projectPhotosService.getProjectsByCategory(category);
      
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
    } catch (error) {
      console.error('Error getting projects by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get projects by category'
      });
    }
  }

  /**
   * Get projects by category slug
   */
  async getProjectsByCategorySlug(req: Request, res: Response) {
    try {
      const { categorySlug } = req.params;
      const projects = projectPhotosService.getProjectsByCategorySlug(categorySlug);
      
      if (projects.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No projects found for category slug: ${categorySlug}`
        });
      }

      const category = projectPhotosService.getCategoryBySlug(categorySlug);

      res.json({
        success: true,
        data: {
          category: category?.name || categorySlug,
          categorySlug,
          projects,
          count: projects.length
        }
      });
    } catch (error) {
      console.error('Error getting projects by category slug:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get projects by category slug'
      });
    }
  }

  /**
   * Get a specific project by slugs
   */
  async getProjectBySlugs(req: Request, res: Response) {
    try {
      const { categorySlug, projectSlug } = req.params;
      const project = projectPhotosService.getProjectBySlug(categorySlug, projectSlug);
      
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
    } catch (error) {
      console.error('Error getting project by slugs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get project'
      });
    }
  }

  /**
   * Search projects
   */
  async searchProjects(req: Request, res: Response) {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Search query parameter "q" is required'
        });
      }

      const results = projectPhotosService.searchProjects(q);

      res.json({
        success: true,
        data: {
          query: q,
          results,
          count: results.length
        }
      });
    } catch (error) {
      console.error('Error searching projects:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search projects'
      });
    }
  }

  /**
   * Get projects by file extension
   */
  async getProjectsByExtension(req: Request, res: Response) {
    try {
      const { extension } = req.params;
      const projects = projectPhotosService.getProjectsByExtension(extension);

      res.json({
        success: true,
        data: {
          extension,
          projects,
          count: projects.length
        }
      });
    } catch (error) {
      console.error('Error getting projects by extension:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get projects by extension'
      });
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const stats = projectPhotosService.getStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics'
      });
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(req: Request, res: Response) {
    try {
      const { categorySlug } = req.params;
      const category = projectPhotosService.getCategoryBySlug(categorySlug);
      
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
    } catch (error) {
      console.error('Error getting category by slug:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get category'
      });
    }
  }
}

export default new ProjectPhotosController(); 