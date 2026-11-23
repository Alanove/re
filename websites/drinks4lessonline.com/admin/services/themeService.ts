import { db } from '../../src/config/database';

interface ThemeConfig {
  [key: string]: any;
}

export class ThemeService {
  private static instance: ThemeService;
  private cacheTime: number = 0;
  private cacheConfig: ThemeConfig | null = null;
  private cacheDuration: number = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private async loadConfig(): Promise<ThemeConfig> {
    // Return cached config if still valid
    if (this.cacheConfig && (Date.now() - this.cacheTime) < this.cacheDuration) {
      return this.cacheConfig;
    }

    try {
      const [rows] = await db.query(`
        SELECT theme_key, theme_value
        FROM theme_config
      `);

      const config: ThemeConfig = {};
      
      for (const row of (rows as any[])) {
        const key = row.theme_key;
        let value = row.theme_value;
        
        // Parse JSON values
        if (value && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
        
        config[key] = value;
      }

      this.cacheConfig = config;
      this.cacheTime = Date.now();
      
      return config;
    } catch (error) {
      console.error('Error loading theme config:', error);
      return {};
    }
  }

  public async getConfig(): Promise<ThemeConfig> {
    return await this.loadConfig();
  }

  public async getSetting(key: string): Promise<any> {
    const config = await this.loadConfig();
    return config[key];
  }

  public async updateConfig(updates: Partial<ThemeConfig>): Promise<boolean> {
    try {
      for (const [key, value] of Object.entries(updates)) {
        const settingValue = typeof value === 'string' ? value : JSON.stringify(value);
        
        // MySQL upsert using ON DUPLICATE KEY UPDATE
        await db.query(`
          INSERT INTO theme_config (theme_key, theme_value)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE theme_value = ?
        `, [key, settingValue, settingValue]);
      }
      
      // Invalidate cache
      this.cacheConfig = null;
      
      return true;
    } catch (error) {
      console.error('Error updating theme config:', error);
      return false;
    }
  }

  public async deleteSetting(key: string): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM theme_config WHERE theme_key = ?
      `, [key]);
      
      // Invalidate cache
      this.cacheConfig = null;
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting theme setting:', error);
      return false;
    }
  }

  public reloadConfig(): void {
    this.cacheConfig = null;
    this.cacheTime = 0;
  }

  public async getThemeClasses(): Promise<string[]> {
    const config = await this.loadConfig();
    const classes: string[] = [];
    
    // Add theme classes based on configuration
    if (config.theme) {
      classes.push(`theme-${config.theme}`);
    }
    
    // Add any additional theme classes
    if (config.themeClasses && Array.isArray(config.themeClasses)) {
      classes.push(...config.themeClasses);
    }
    
    return classes;
  }

  public async getCurrentTheme(): Promise<string> {
    const config = await this.loadConfig();
    return config.theme || 'default';
  }
}

export const themeService = ThemeService.getInstance();
