import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../../src/constants';

// Theme configuration interface
export interface ThemeConfig {
  currentTheme: string;
  darkMode: boolean;
  customSettings?: Record<string, any>;
}

// Available themes
export const AVAILABLE_THEMES: Record<string, { name: string; class: string; color: string }> = {
  'default': { name: 'Default', class: '', color: 'teal' },
  'theme-red': { name: 'Red', class: 'theme-red', color: 'red' },
  'theme-pink': { name: 'Pink', class: 'theme-pink', color: 'pink' },
  'theme-orange': { name: 'Orange', class: 'theme-orange', color: 'orange' },
  'theme-yellow': { name: 'Yellow', class: 'theme-yellow', color: 'yellow' },
  'theme-lime': { name: 'Lime', class: 'theme-lime', color: 'lime' },
  'theme-green': { name: 'Green', class: 'theme-green', color: 'green' },
  'theme-cyan': { name: 'Cyan', class: 'theme-cyan', color: 'cyan' },
  'theme-blue': { name: 'Blue', class: 'theme-blue', color: 'blue' },
  'theme-purple': { name: 'Purple', class: 'theme-purple', color: 'purple' },
  'theme-indigo': { name: 'Indigo', class: 'theme-indigo', color: 'indigo' },
  'theme-gray-600': { name: 'Black', class: 'theme-gray-600', color: 'black' }
};

export class ThemeService {
  private static instance: ThemeService;
  private configFile: string;
  private defaultConfig: ThemeConfig = {
    currentTheme: 'default',
    darkMode: false
  };

  private constructor() {
    // Set config file path using data paths constants
    this.configFile = DATA_PATHS.THEME_CONFIG_FILE;
    this.init();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Initialize theme service
   */
  private init(): void {
    // Ensure data directory exists
    const dataDir = path.dirname(this.configFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create default config if it doesn't exist
    if (!fs.existsSync(this.configFile)) {
      this.saveTheme(this.defaultConfig);
    }
  }

  /**
   * Load theme configuration from file
   */
  private loadTheme(): ThemeConfig {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        const config = JSON.parse(data);
        return { ...this.defaultConfig, ...config };
      }
    } catch (error) {
      console.error('Error loading theme from file:', error);
    }
    return this.defaultConfig;
  }

  /**
   * Save theme configuration to file
   */
  private saveTheme(config: ThemeConfig): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving theme to file:', error);
    }
  }

  /**
   * Get current theme configuration
   */
  public getCurrentTheme(): ThemeConfig {
    return this.loadTheme();
  }

  /**
   * Set theme
   */
  public setTheme(themeName: string): void {
    const config = this.loadTheme();
    config.currentTheme = themeName;
    this.saveTheme(config);
  }

  /**
   * Toggle dark mode
   */
  public toggleDarkMode(): boolean {
    const config = this.loadTheme();
    config.darkMode = !config.darkMode;
    this.saveTheme(config);
    return config.darkMode;
  }

  /**
   * Set dark mode
   */
  public setDarkMode(enabled: boolean): void {
    const config = this.loadTheme();
    config.darkMode = enabled;
    this.saveTheme(config);
  }

  /**
   * Reset theme to default
   */
  public resetTheme(): void {
    this.saveTheme(this.defaultConfig);
  }

  /**
   * Get available themes
   */
  public getAvailableThemes(): typeof AVAILABLE_THEMES {
    return AVAILABLE_THEMES;
  }

  /**
   * Check if dark mode is enabled
   */
  public isDarkMode(): boolean {
    return this.loadTheme().darkMode;
  }

  /**
   * Get current theme name
   */
  public getCurrentThemeName(): string {
    return this.loadTheme().currentTheme;
  }

  /**
   * Get theme CSS variables for custom styling
   */
  public getThemeVariables(): Record<string, string> {
    const config = this.loadTheme();
    const theme = AVAILABLE_THEMES[config.currentTheme];
    
    // You can extend this with actual CSS variable values
    return {
      '--primary-color': theme?.color || 'teal',
      '--theme-name': theme?.name || 'Default',
      '--is-dark-mode': config.darkMode ? 'true' : 'false'
    };
  }

  /**
   * Export theme configuration
   */
  public exportTheme(): ThemeConfig {
    return this.loadTheme();
  }

  /**
   * Import theme configuration
   */
  public importTheme(config: ThemeConfig): void {
    this.saveTheme(config);
  }

  /**
   * Get theme classes for HTML body
   */
  public getThemeClasses(): string[] {
    const config = this.loadTheme();
    const classes: string[] = [];

    // Add theme class
    if (config.currentTheme !== 'default' && AVAILABLE_THEMES[config.currentTheme]) {
      const theme = AVAILABLE_THEMES[config.currentTheme];
      if (theme && theme.class) {
        classes.push(theme.class);
      }
    }

    // Add dark mode class
    if (config.darkMode) {
      classes.push('theme-dark');
    } else {
      classes.push('theme-light');
    }

    return classes;
  }
}

// Export singleton instance
export const themeService = ThemeService.getInstance(); 