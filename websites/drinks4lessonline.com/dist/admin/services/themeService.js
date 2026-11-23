"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeService = exports.ThemeService = void 0;
const database_1 = require("../../src/config/database");
class ThemeService {
    constructor() {
        this.cacheTime = 0;
        this.cacheConfig = null;
        this.cacheDuration = 5000;
    }
    static getInstance() {
        if (!ThemeService.instance) {
            ThemeService.instance = new ThemeService();
        }
        return ThemeService.instance;
    }
    async loadConfig() {
        if (this.cacheConfig && (Date.now() - this.cacheTime) < this.cacheDuration) {
            return this.cacheConfig;
        }
        try {
            const [rows] = await database_1.db.query(`
        SELECT theme_key, theme_value
        FROM theme_config
      `);
            const config = {};
            for (const row of rows) {
                const key = row.theme_key;
                let value = row.theme_value;
                if (value && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        value = JSON.parse(value);
                    }
                    catch (e) {
                    }
                }
                config[key] = value;
            }
            this.cacheConfig = config;
            this.cacheTime = Date.now();
            return config;
        }
        catch (error) {
            console.error('Error loading theme config:', error);
            return {};
        }
    }
    async getConfig() {
        return await this.loadConfig();
    }
    async getSetting(key) {
        const config = await this.loadConfig();
        return config[key];
    }
    async updateConfig(updates) {
        try {
            for (const [key, value] of Object.entries(updates)) {
                const settingValue = typeof value === 'string' ? value : JSON.stringify(value);
                await database_1.db.query(`
          INSERT INTO theme_config (theme_key, theme_value)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE theme_value = ?
        `, [key, settingValue, settingValue]);
            }
            this.cacheConfig = null;
            return true;
        }
        catch (error) {
            console.error('Error updating theme config:', error);
            return false;
        }
    }
    async deleteSetting(key) {
        try {
            const [result] = await database_1.db.query(`
        DELETE FROM theme_config WHERE theme_key = ?
      `, [key]);
            this.cacheConfig = null;
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting theme setting:', error);
            return false;
        }
    }
    reloadConfig() {
        this.cacheConfig = null;
        this.cacheTime = 0;
    }
    async getThemeClasses() {
        const config = await this.loadConfig();
        const classes = [];
        if (config.theme) {
            classes.push(`theme-${config.theme}`);
        }
        if (config.themeClasses && Array.isArray(config.themeClasses)) {
            classes.push(...config.themeClasses);
        }
        return classes;
    }
    async getCurrentTheme() {
        const config = await this.loadConfig();
        return config.theme || 'default';
    }
}
exports.ThemeService = ThemeService;
exports.themeService = ThemeService.getInstance();
//# sourceMappingURL=themeService.js.map