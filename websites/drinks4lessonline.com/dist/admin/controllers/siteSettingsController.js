"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettingsController = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const storageService_1 = require("../services/storageService");
const securityService_1 = require("../../src/services/securityService");
const pagesService_1 = __importDefault(require("../../src/services/pagesService"));
const constants_1 = require("../../src/constants");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
const multer = require('multer');
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = constants_1.DATA_PATHS.IMAGES_DIR;
            console.log('Upload directory:', uploadDir);
            if (!fs.existsSync(uploadDir)) {
                console.log('Creating upload directory:', uploadDir);
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            let filename;
            if (file.fieldname === 'logoFile') {
                filename = `logo-${uniqueSuffix}${ext}`;
            }
            else if (file.fieldname === 'faviconFile') {
                filename = `favicon-${uniqueSuffix}${ext}`;
            }
            else if (file.fieldname === 'siteImageFile') {
                filename = `site-image-${uniqueSuffix}${ext}`;
            }
            else {
                filename = `site-${file.fieldname}-${uniqueSuffix}${ext}`;
            }
            cb(null, filename);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    onError: (err, next) => {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            console.error('File too large');
        }
        next(err);
    },
    fileFilter: (req, file, cb) => {
        console.log('File being processed:', file.originalname, 'MIME type:', file.mimetype);
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/ico', 'image/x-icon'];
        if (allowedTypes.includes(file.mimetype)) {
            console.log('File type accepted:', file.mimetype);
            cb(null, true);
        }
        else {
            console.log('File type rejected:', file.mimetype);
            cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
        }
    }
});
class SiteSettingsController {
    static async siteSettings(req, res) {
        try {
            const settings = await siteSettingsService.getAllSettings();
            const siteTitle = await siteSettingsService.getSiteTitle();
            res.render('site-settings/site-settings', {
                title: 'Settings',
                pageTitle: 'Settings',
                pageSubtitle: 'Manage your website configuration and appearance',
                settings: settings,
                siteTitle: siteTitle,
                success: req.query['success'],
                error: req.query['error']
            });
        }
        catch (error) {
            console.error('Error rendering site settings:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async updateSettings(req, res) {
        try {
            console.log('Starting site settings update...');
            console.log('Request body:', req.body);
            console.log('Request files:', req.files);
            upload.fields([
                { name: 'logoFile', maxCount: 1 },
                { name: 'faviconFile', maxCount: 1 },
                { name: 'siteImageFile', maxCount: 1 }
            ])(req, res, async (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    console.error('Error details:', err.message);
                    return res.redirect('/admin/site-settings?error=File upload failed: ' + err.message);
                }
                securityService_1.securityService.csrfProtection(req, res, async (csrfErr) => {
                    if (csrfErr) {
                        console.error('CSRF validation failed:', csrfErr);
                        return res.redirect('/admin/site-settings?error=Security token validation failed. Please try again.');
                    }
                    try {
                        const currentSettings = await siteSettingsService.getAllSettings();
                        const updatedSettings = { ...currentSettings };
                        updatedSettings.siteTitle = req.body.siteTitle || '';
                        updatedSettings.siteSlogan = req.body.siteSlogan || '';
                        updatedSettings.siteDescription = req.body.siteDescription || '';
                        updatedSettings.siteUrl = req.body.siteUrl || '';
                        updatedSettings.contactEmail = req.body.contactEmail || '';
                        updatedSettings.contactEmail = req.body.contactEmail || '';
                        updatedSettings.contactPhone = req.body.contactPhone || '';
                        updatedSettings.contactWhatsapp = req.body.contactWhatsapp || '';
                        updatedSettings.address = req.body.address || '';
                        updatedSettings.socialMedia = {
                            facebook: req.body.facebook || '',
                            twitter: req.body.twitter || '',
                            instagram: req.body.instagram || '',
                            linkedin: req.body.linkedin || '',
                            youtube: req.body.youtube || ''
                        };
                        updatedSettings.seo = {
                            defaultTitle: req.body.defaultTitle || '',
                            defaultDescription: req.body.defaultDescription || '',
                            defaultKeywords: req.body.defaultKeywords || ''
                        };
                        updatedSettings.googleMaps = {
                            embedUrl: req.body.googleMapsEmbedUrl || '',
                            directionsUrl: req.body.googleMapsDirectionsUrl || '',
                            latitude: req.body.googleMapsLatitude || '',
                            longitude: req.body.googleMapsLongitude || ''
                        };
                        updatedSettings.downloadLinks = {
                            portfolio: req.body.portfolioLink || '',
                            brochure: req.body.brochureLink || '',
                            catalog: req.body.catalogLink || ''
                        };
                        updatedSettings.analyticsScript = req.body.analyticsScript || '';
                        const files = req.files;
                        if (files['logoFile'] && files['logoFile'][0]) {
                            const logoFile = files['logoFile'][0];
                            const logoPath = `/images/${logoFile.filename}`;
                            updatedSettings.logo = logoPath;
                        }
                        if (files['faviconFile'] && files['faviconFile'][0]) {
                            const faviconFile = files['faviconFile'][0];
                            const faviconPath = `/images/${faviconFile.filename}`;
                            updatedSettings.favicon = faviconPath;
                        }
                        if (files['siteImageFile'] && files['siteImageFile'][0]) {
                            const siteImageFile = files['siteImageFile'][0];
                            const siteImagePath = `/images/${siteImageFile.filename}`;
                            updatedSettings.siteImage = siteImagePath;
                        }
                        const success = await siteSettingsService.updateSettings(updatedSettings);
                        if (success) {
                            await pagesService_1.default.reloadCache();
                            res.redirect('/admin/site-settings?success=Site settings updated successfully');
                        }
                        else {
                            res.redirect('/admin/site-settings?error=Failed to update site settings');
                        }
                    }
                    catch (error) {
                        console.error('Error updating site settings:', error);
                        res.redirect('/admin/site-settings?error=An error occurred while updating settings');
                    }
                });
            });
        }
        catch (error) {
            console.error('Error in updateSettings:', error);
            res.redirect('/admin/site-settings?error=An error occurred');
        }
    }
    static async testUpload(req, res) {
        try {
            console.log('Test upload endpoint called');
            console.log('Request body:', req.body);
            console.log('Request files:', req.files);
            res.json({
                success: true,
                message: 'Test upload endpoint working',
                body: req.body,
                files: req.files
            });
        }
        catch (error) {
            console.error('Test upload error:', error);
            res.status(500).json({ error: 'Test upload failed' });
        }
    }
    static async deleteSiteImage(req, res) {
        try {
            const imageType = req.params['type'];
            const currentSettings = await siteSettingsService.getAllSettings();
            let imagePath = '';
            let defaultPath = '';
            switch (imageType) {
                case 'logo':
                    imagePath = currentSettings.logo;
                    defaultPath = '/images/logo.jpg';
                    break;
                case 'favicon':
                    imagePath = currentSettings.favicon;
                    defaultPath = '/images/favicon.ico';
                    break;
                case 'siteImage':
                    imagePath = currentSettings.siteImage;
                    defaultPath = '/images/site-image.jpg';
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid image type' });
            }
            if (imagePath && imagePath !== defaultPath) {
                const fullPath = path.join(constants_1.DATA_PATHS.PUBLIC_DIR, imagePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
                const updatedSettings = { ...currentSettings };
                if (imageType === 'logo') {
                    updatedSettings.logo = defaultPath;
                }
                else if (imageType === 'favicon') {
                    updatedSettings.favicon = defaultPath;
                }
                else if (imageType === 'siteImage') {
                    updatedSettings.siteImage = defaultPath;
                }
                siteSettingsService.updateSettings(updatedSettings);
                await pagesService_1.default.reloadCache();
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting site image:', error);
            res.status(500).json({ error: 'Failed to delete image' });
        }
    }
}
exports.SiteSettingsController = SiteSettingsController;
//# sourceMappingURL=siteSettingsController.js.map