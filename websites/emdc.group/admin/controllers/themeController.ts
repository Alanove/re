import { Request, Response } from 'express';
import { themeService, ThemeConfig } from '../services/themeService';
import { SiteSettingsService } from '../services/siteSettingsService';

const siteSettingsService = SiteSettingsService.getInstance();

export class ThemeController {
  /**
   * Render theme management page
   */
  public static themeManagement(req: Request, res: Response): void {
    try {
      const currentTheme = themeService.getCurrentTheme();
      const availableThemes = themeService.getAvailableThemes();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('theme/management', {
        pageTitle: 'Theme Management',
        pageSubtitle: 'Customize the admin panel appearance',
        siteTitle: siteTitle,
        currentTheme,
        availableThemes
      });
    } catch (error) {
      res.status(500).render('error', {
        pageTitle: 'Error',
        message: 'Failed to load theme management page',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get current theme configuration
   */
  public static getCurrentTheme(req: Request, res: Response): void {
    try {
      const theme = themeService.getCurrentTheme();
      res.json({
        success: true,
        data: theme
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get theme configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set theme
   */
  public static setTheme(req: Request, res: Response): void {
    try {
      const { themeName } = req.body;
      
      if (!themeName) {
        res.status(400).json({
          success: false,
          message: 'Theme name is required'
        });
        return;
      }

      themeService.setTheme(themeName);
      
      res.json({
        success: true,
        message: 'Theme updated successfully',
        data: themeService.getCurrentTheme()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to set theme',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Toggle dark mode
   */
  public static toggleDarkMode(req: Request, res: Response): void {
    try {
      const isDarkMode = themeService.toggleDarkMode();
      
      res.json({
        success: true,
        message: `Dark mode ${isDarkMode ? 'enabled' : 'disabled'}`,
        data: {
          darkMode: isDarkMode,
          theme: themeService.getCurrentTheme()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to toggle dark mode',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set dark mode
   */
  public static setDarkMode(req: Request, res: Response): void {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'Enabled parameter must be a boolean'
        });
        return;
      }

      themeService.setDarkMode(enabled);
      
      res.json({
        success: true,
        message: `Dark mode ${enabled ? 'enabled' : 'disabled'}`,
        data: themeService.getCurrentTheme()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to set dark mode',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reset theme to default
   */
  public static resetTheme(req: Request, res: Response): void {
    try {
      themeService.resetTheme();
      
      res.json({
        success: true,
        message: 'Theme reset to default',
        data: themeService.getCurrentTheme()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to reset theme',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get available themes
   */
  public static getAvailableThemes(req: Request, res: Response): void {
    try {
      const themes = themeService.getAvailableThemes();
      
      res.json({
        success: true,
        data: themes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get available themes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export theme configuration
   */
  public static exportTheme(req: Request, res: Response): void {
    try {
      const theme = themeService.exportTheme();
      
      res.json({
        success: true,
        data: theme
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export theme',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Import theme configuration
   */
  public static importTheme(req: Request, res: Response): void {
    try {
      const themeConfig: ThemeConfig = req.body;
      
      if (!themeConfig || typeof themeConfig !== 'object') {
        res.status(400).json({
          success: false,
          message: 'Valid theme configuration is required'
        });
        return;
      }

      themeService.importTheme(themeConfig);
      
      res.json({
        success: true,
        message: 'Theme imported successfully',
        data: themeService.getCurrentTheme()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to import theme',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get theme variables for CSS
   */
  public static getThemeVariables(req: Request, res: Response): void {
    try {
      const variables = themeService.getThemeVariables();
      
      res.json({
        success: true,
        data: variables
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get theme variables',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 