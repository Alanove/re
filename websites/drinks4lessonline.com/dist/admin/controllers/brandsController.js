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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandsController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const brandManagementService_1 = require("../services/brandManagementService");
const i18nService_1 = require("../services/i18nService");
const storageService_1 = require("../services/storageService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const brandService = brandManagementService_1.BrandManagementService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
class BrandsController {
    static async index(req, res) {
        try {
            let brands = [];
            try {
                const allBrands = await brandService.getAllBrands(true);
                brands = Array.isArray(allBrands) ? allBrands : [];
            }
            catch (err) {
                console.error('BrandManagementService.getAllBrands failed, using frontend service:', err);
                const frontendBrandService = (await Promise.resolve().then(() => __importStar(require('../../src/services/brandService')))).default;
                const active = await frontendBrandService.getActiveBrands();
                brands = Array.isArray(active) ? active.map((b) => ({ ...b, is_active: b.is_active ?? true })) : [];
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('brands/brands', {
                title: 'Brands',
                pageTitle: 'Brands Management',
                siteTitle,
                t,
                brands,
                success: req.query.success,
                error: req.query.error
            });
        }
        catch (error) {
            console.error('Error rendering brands page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async createBrand(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('brands/create-brand', {
                title: 'Create Brand',
                pageTitle: 'Create New Brand',
                siteTitle,
                t
            });
        }
        catch (error) {
            console.error('Error rendering create brand page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async createBrandPost(req, res) {
        try {
            const { name, slug, description, website_url, is_featured, display_order, is_active, meta_title, meta_description, meta_keywords } = req.body;
            const brandData = {
                name,
                is_featured: is_featured === 'true' || is_featured === 'on',
                display_order: display_order ? parseInt(display_order) : 0,
                is_active: is_active === 'true' || is_active === 'on' || is_active === undefined
            };
            if (req.file) {
                brandData.logo_url = await storageService.saveBrandLogo(req.file);
            }
            if (slug)
                brandData.slug = slug;
            if (description)
                brandData.description = description;
            if (website_url)
                brandData.website_url = website_url;
            if (meta_title)
                brandData.meta_title = meta_title;
            if (meta_description)
                brandData.meta_description = meta_description;
            if (meta_keywords)
                brandData.meta_keywords = meta_keywords;
            await brandService.createBrand(brandData);
            res.redirect('/admin/brands?success=Brand created successfully');
        }
        catch (error) {
            console.error('Error creating brand:', error);
            res.redirect(`/admin/brands/create?error=${encodeURIComponent(error.message || 'Failed to create brand')}`);
        }
    }
    static async editBrand(req, res) {
        try {
            const brandId = parseInt(req.params.id);
            const brand = await brandService.getBrandById(brandId);
            if (!brand) {
                res.status(404).render('admin/error', { error: 'Brand not found' });
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('brands/edit-brand', {
                title: `Edit Brand - ${brand.name}`,
                pageTitle: `Edit Brand - ${brand.name}`,
                siteTitle,
                t,
                brand
            });
        }
        catch (error) {
            console.error('Error rendering edit brand page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async editBrandPost(req, res) {
        try {
            const brandId = parseInt(req.params.id);
            const { name, slug, description, website_url, is_featured, display_order, is_active, meta_title, meta_description, meta_keywords, delete_logo } = req.body;
            const updateData = {};
            if (name)
                updateData.name = name;
            if (is_featured !== undefined)
                updateData.is_featured = is_featured === 'true' || is_featured === 'on';
            if (display_order !== undefined)
                updateData.display_order = display_order ? parseInt(display_order) : 0;
            if (is_active !== undefined)
                updateData.is_active = is_active === 'true' || is_active === 'on';
            if (delete_logo === 'true') {
                updateData.logo_url = undefined;
            }
            else if (req.file) {
                updateData.logo_url = await storageService.saveBrandLogo(req.file);
            }
            if (slug)
                updateData.slug = slug;
            if (description)
                updateData.description = description;
            if (website_url)
                updateData.website_url = website_url;
            if (meta_title)
                updateData.meta_title = meta_title;
            if (meta_description)
                updateData.meta_description = meta_description;
            if (meta_keywords)
                updateData.meta_keywords = meta_keywords;
            await brandService.updateBrand(brandId, updateData);
            res.redirect(`/admin/brands/${brandId}/edit?success=Brand updated successfully`);
        }
        catch (error) {
            console.error('Error updating brand:', error);
            res.redirect(`/admin/brands/${req.params.id}/edit?error=${encodeURIComponent(error.message || 'Failed to update brand')}`);
        }
    }
    static async deleteBrand(req, res) {
        try {
            const brandId = parseInt(req.params.id);
            await brandService.deleteBrand(brandId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting brand:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete brand' });
        }
    }
    static async deleteBrandLogo(req, res) {
        try {
            const brandId = parseInt(req.params.id);
            await brandService.updateBrand(brandId, { logo_url: undefined });
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting brand logo:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete brand logo' });
        }
    }
}
exports.BrandsController = BrandsController;
//# sourceMappingURL=brandsController.js.map