"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeController = void 0;
const siteSettingsService_1 = require("../services/siteSettingsService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
class ThemeController {
    static async themeManagement(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            res.render('theme/management', {
                pageTitle: 'Theme Management',
                pageSubtitle: 'Theme switching functionality has been disabled',
                siteTitle: siteTitle
            });
        }
        catch (error) {
            res.status(500).render('error', {
                pageTitle: 'Error',
                message: 'Failed to load theme management page',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    static getCurrentTheme(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static setTheme(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static toggleDarkMode(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static setDarkMode(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static resetTheme(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static getAvailableThemes(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static exportTheme(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static importTheme(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
    static getThemeVariables(req, res) {
        res.json({
            success: false,
            message: 'Theme functionality has been disabled'
        });
    }
}
exports.ThemeController = ThemeController;
//# sourceMappingURL=themeController.js.map