"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomepageController = void 0;
const homepageSettingsService_1 = require("../services/homepageSettingsService");
const storageService_1 = require("../services/storageService");
const homepageSettingsService = homepageSettingsService_1.HomepageSettingsService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
const upload = storageService.createHomepageBannerUploadConfig();
class HomepageController {
    static handleBannerUpload(req, res, next) {
        upload.single('banner_image')(req, res, (err) => {
            if (err) {
                const message = err.code === 'LIMIT_FILE_SIZE'
                    ? 'Image is too large. Maximum size is 10MB.'
                    : (err.message || 'File upload failed');
                res.redirect('/admin/homepage?error=' + encodeURIComponent(message));
                return;
            }
            next();
        });
    }
    static async index(req, res) {
        try {
            const settings = await homepageSettingsService.getSettings();
            const t = res.locals.t || ((key) => key);
            res.render('homepage/homepage', {
                title: t('homepage.title'),
                pageTitle: t('homepage.title'),
                settings,
                success: typeof req.query['success'] === 'string' ? req.query['success'] : undefined,
                error: typeof req.query['error'] === 'string' ? req.query['error'] : undefined
            });
        }
        catch (error) {
            console.error('Error rendering homepage settings:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async update(req, res) {
        try {
            const current = await homepageSettingsService.getSettings();
            const body = req.body || {};
            const file = req.file;
            let bannerImage = current.bannerImage;
            const removeBanner = body.remove_banner_image === '1' || body.remove_banner_image === 'on';
            if (file) {
                bannerImage = `/images/homepage/${file.filename}`;
            }
            else if (removeBanner) {
                bannerImage = '';
            }
            const saleEnabled = body.sale_enabled === '1' || body.sale_enabled === 'on' || body.sale_enabled === 'true';
            await homepageSettingsService.updateSettings({
                bannerImage,
                bannerText: String(body.banner_text || '').trim() || homepageSettingsService_1.DEFAULT_HOMEPAGE_BANNER_TEXT,
                bannerLink: (0, homepageSettingsService_1.cleanHomepageLink)(body.banner_link),
                newArrivalsTitle: String(body.new_arrivals_title || '').trim() || homepageSettingsService_1.DEFAULT_NEW_ARRIVALS_TITLE,
                saleTitle: String(body.sale_title || '').trim() || homepageSettingsService_1.DEFAULT_SALE_TITLE,
                saleEnabled,
                saleMetaTitle: String(body.sale_meta_title || '').trim(),
                saleMetaDescription: String(body.sale_meta_description || '').trim()
            });
            res.redirect('/admin/homepage?success=Homepage+settings+saved');
        }
        catch (error) {
            console.error('Error saving homepage settings:', error);
            res.redirect('/admin/homepage?error=' + encodeURIComponent('Failed to save homepage settings'));
        }
    }
}
exports.HomepageController = HomepageController;
//# sourceMappingURL=homepageController.js.map