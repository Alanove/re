import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AdminMenuService } from '../services/adminMenuService';
import { HeroService } from '../services/heroService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import { DATA_PATHS } from '../../src/constants/data-paths';

const menuService = AdminMenuService.getInstance();
const heroService = HeroService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

// Get multer configuration for video uploads
const videoUpload = storageService.createVideoUploadConfig();

export class HeroController {
  /**
   * Render hero section management page
   */
  public static async heroSection(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/hero-section');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get hero section data
      const heroData = heroService.getHeroSectionData();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      // Get statistics
      const statistics = heroService.getStatistics();

      res.render('hero/hero-section', {
        title: 'Hero Section Management',
        pageTitle: 'Hero Section Management',
        pageSubtitle: 'Manage hero video and rotating quotes',
        heroData: heroData,
        statistics: statistics,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering hero section:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Update current video
   */
  public static async updateVideo(req: Request, res: Response): Promise<void> {
    try {
      const { videoName } = req.body;
      
      if (!videoName) {
        return res.redirect('/admin/hero-section?error=Video name is required');
      }

      heroService.setCurrentVideo(videoName);
      res.redirect('/admin/hero-section?success=Video updated successfully');
    } catch (error) {
      console.error('Error updating video:', error);
      res.redirect('/admin/hero-section?error=Failed to update video');
    }
  }

  /**
   * Update video background type
   */
  public static async updateVideoBackgroundType(req: Request, res: Response): Promise<void> {
    try {
      const { filename, backgroundType } = req.body;
      
      if (!filename || !backgroundType) {
        return res.redirect('/admin/hero-section?error=Filename and background type are required');
      }

      if (backgroundType !== 'light' && backgroundType !== 'dark') {
        return res.redirect('/admin/hero-section?error=Invalid background type');
      }

      heroService.updateVideoBackgroundType(filename, backgroundType);
      res.redirect('/admin/hero-section?success=Video background type updated successfully');
    } catch (error) {
      console.error('Error updating video background type:', error);
      res.redirect('/admin/hero-section?error=Failed to update video background type');
    }
  }

  /**
   * Add a new quote
   */
  public static async addQuote(req: Request, res: Response): Promise<void> {
    try {
      const { text, author } = req.body;
      
      if (!text || !author) {
        return res.redirect('/admin/hero-section?error=Quote text and author are required');
      }

      heroService.addQuote(text, author);
      res.redirect('/admin/hero-section?success=Quote added successfully');
    } catch (error) {
      console.error('Error adding quote:', error);
      res.redirect('/admin/hero-section?error=Failed to add quote');
    }
  }

  /**
   * Update a quote
   */
  public static async updateQuote(req: Request, res: Response): Promise<void> {
    try {
      const { id, text, author, active } = req.body;
      
      if (!id || !text || !author) {
        return res.redirect('/admin/hero-section?error=Quote ID, text and author are required');
      }

      const quoteId = parseInt(id);
      // Checkbox sends 'on' when checked, or undefined when unchecked
      const isActive = active === 'true' || active === true || active === 'on';
      
      heroService.updateQuote(quoteId, text, author, isActive);
      res.redirect('/admin/hero-section?success=Quote updated successfully');
    } catch (error) {
      console.error('Error updating quote:', error);
      res.redirect('/admin/hero-section?error=Failed to update quote');
    }
  }

  /**
   * Delete a quote
   */
  public static async deleteQuote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.redirect('/admin/hero-section?error=Quote ID is required');
      }

      const quoteId = parseInt(id);
      heroService.deleteQuote(quoteId);
      res.redirect('/admin/hero-section?success=Quote deleted successfully');
    } catch (error) {
      console.error('Error deleting quote:', error);
      res.redirect('/admin/hero-section?error=Failed to delete quote');
    }
  }

  /**
   * Upload a new video file
   */
  public static async uploadVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        return res.redirect('/admin/hero-section?error=No video file uploaded');
      }

      const filename = req.file.filename;
      heroService.addVideoFile(filename);
      
      res.redirect('/admin/hero-section?success=Video uploaded successfully');
    } catch (error) {
      console.error('Error uploading video:', error);
      res.redirect('/admin/hero-section?error=Failed to upload video');
    }
  }

  /**
   * Delete a video file
   */
  public static async deleteVideo(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.redirect('/admin/hero-section?error=Filename is required');
      }

      // Check if file exists and delete it
      const filePath = path.join(DATA_PATHS.VIDEOS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from available videos
      heroService.removeVideoFile(filename);
      
      res.redirect('/admin/hero-section?success=Video deleted successfully');
    } catch (error) {
      console.error('Error deleting video:', error);
      res.redirect('/admin/hero-section?error=Failed to delete video');
    }
  }

  /**
   * Refresh available videos
   */
  public static async refreshVideos(req: Request, res: Response): Promise<void> {
    try {
      heroService.refreshAvailableVideos();
      res.redirect('/admin/hero-section?success=Videos refreshed successfully');
    } catch (error) {
      console.error('Error refreshing videos:', error);
      res.redirect('/admin/hero-section?error=Failed to refresh videos');
    }
  }
}
