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
exports.StorageService = void 0;
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const constants_1 = require("../../src/constants");
const siteSettingsService_1 = require("./siteSettingsService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
class StorageService {
    constructor() {
        this.tempDir = constants_1.DATA_PATHS.TEMP_DIR;
        this.pagesDir = constants_1.DATA_PATHS.PAGES_DIR;
        this.imagesDir = constants_1.DATA_PATHS.IMAGES_DIR;
        this.sliderDir = constants_1.DATA_PATHS.SLIDER_DIR;
        this.homepageDir = constants_1.DATA_PATHS.HOMEPAGE_DIR;
        this.ensureDirectories();
    }
    static getInstance() {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService();
        }
        return StorageService.instance;
    }
    ensureDirectories() {
        const directories = [this.tempDir, this.pagesDir, this.imagesDir, this.sliderDir, this.homepageDir];
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    async getDefaultLogo() {
        const siteSettings = await siteSettingsService.getAllSettings();
        return siteSettings.logo || '/images/logo.jpg';
    }
    async saveBrandLogo(file) {
        return (0, constants_1.getPublicUrl)(file.path);
    }
    createPageUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                let pageKey = req.params['key'] || req.body.key || 'temp';
                const pageDir = path.join(this.pagesDir, pageKey);
                if (!fs.existsSync(pageDir)) {
                    fs.mkdirSync(pageDir, { recursive: true });
                }
                cb(null, pageDir);
            },
            filename: (req, file, cb) => {
                let pageKey = req.params['key'] || req.body.key || 'temp';
                const ext = path.extname(file.originalname);
                let filename;
                if (file.fieldname === 'seoImageFile') {
                    filename = `${pageKey}-seo${ext}`;
                }
                else if (file.fieldname === 'pagePicture') {
                    filename = `${pageKey}-default${ext}`;
                }
                else {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    filename = `${pageKey}-${file.fieldname}-${uniqueSuffix}${ext}`;
                }
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 50 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files are allowed'));
                }
            }
        });
    }
    createSliderUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                if (!fs.existsSync(this.sliderDir)) {
                    fs.mkdirSync(this.sliderDir, { recursive: true });
                }
                cb(null, this.sliderDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 100 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
                if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) and video files (MP4, WebM, OGG, MOV) are allowed'));
                }
            }
        });
    }
    createHomepageBannerUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (_req, _file, cb) => {
                if (!fs.existsSync(this.homepageDir)) {
                    fs.mkdirSync(this.homepageDir, { recursive: true });
                }
                cb(null, this.homepageDir);
            },
            filename: (_req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                cb(null, `banner-${timestamp}-${randomSuffix}${ext}`);
            }
        });
        return (0, multer_1.default)({
            storage,
            limits: {
                fileSize: 10 * 1024 * 1024,
                fieldSize: 1 * 1024 * 1024,
                fields: 30
            },
            fileFilter: (_req, file, cb) => {
                const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedImageTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
                }
            }
        });
    }
    createQuillUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                if (!fs.existsSync(this.tempDir)) {
                    fs.mkdirSync(this.tempDir, { recursive: true });
                }
                cb(null, this.tempDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `quill-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 50 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files are allowed'));
                }
            }
        });
    }
    createPageGalleryUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                let pageKey = req.params['key'] || 'temp';
                const galleryDir = path.join(this.pagesDir, pageKey, 'gallery');
                if (!fs.existsSync(galleryDir)) {
                    fs.mkdirSync(galleryDir, { recursive: true });
                }
                cb(null, galleryDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `photo-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 50 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50,
                files: 100
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files are allowed'));
                }
            }
        });
    }
    createPageFileUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                let pageKey = req.params['key'] || req.body.key || 'temp';
                const pageDir = path.join(this.pagesDir, pageKey);
                if (!fs.existsSync(pageDir)) {
                    fs.mkdirSync(pageDir, { recursive: true });
                }
                cb(null, pageDir);
            },
            filename: (req, file, cb) => {
                let pageKey = req.params['key'] || req.body.key || 'temp';
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const baseName = path.basename(file.originalname, ext);
                const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
                const filename = `${sanitizedBaseName}-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 100 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                cb(null, true);
            }
        });
    }
    moveFile(fromPath, toPath) {
        const destDir = path.dirname(toPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(fromPath, toPath);
    }
    deleteFile(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }
    deleteDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            return true;
        }
        return false;
    }
    getFileInfo(filePath) {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            return {
                exists: true,
                size: stats.size,
                modified: stats.mtime
            };
        }
        return { exists: false };
    }
    createPageEditorDirectory(pageKey) {
        const editorDir = (0, constants_1.getPageEditorDirPath)(pageKey);
        if (!fs.existsSync(editorDir)) {
            fs.mkdirSync(editorDir, { recursive: true });
        }
        return editorDir;
    }
    generateEditorFilename(originalname) {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(originalname);
        return `editor-${timestamp}-${randomSuffix}${ext}`;
    }
    getPublicUrl(filePath) {
        return (0, constants_1.getPublicUrl)(filePath);
    }
    resolveProductUploadDestination(req) {
        const rawId = req.params?.['id'] ?? req.query?.['productId'];
        const productId = rawId !== undefined && rawId !== null && rawId !== ''
            ? parseInt(String(rawId), 10)
            : NaN;
        if (!Number.isNaN(productId) && productId > 0) {
            const productDir = path.join(this.imagesDir, 'products', String(productId));
            if (!fs.existsSync(productDir)) {
                fs.mkdirSync(productDir, { recursive: true });
            }
            return productDir;
        }
        const stagingDir = (0, constants_1.getProductImagesStagingDirPath)();
        if (!fs.existsSync(stagingDir)) {
            fs.mkdirSync(stagingDir, { recursive: true });
        }
        return stagingDir;
    }
    createProductImageUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                try {
                    cb(null, this.resolveProductUploadDestination(req));
                }
                catch (err) {
                    cb(err, '');
                }
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `product-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
                }
            }
        });
    }
    createProductImagesUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                try {
                    cb(null, this.resolveProductUploadDestination(req));
                }
                catch (err) {
                    cb(err, '');
                }
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `product-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50,
                files: 20
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
                }
            }
        });
    }
    createCategoryUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                const categoriesDir = path.join(this.imagesDir, 'categories');
                if (!fs.existsSync(categoriesDir)) {
                    fs.mkdirSync(categoriesDir, { recursive: true });
                }
                cb(null, categoriesDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `category-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
                }
            }
        });
    }
    createBrandUploadConfig() {
        const storage = multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                const brandsDir = path.join(this.imagesDir, 'brands');
                if (!fs.existsSync(brandsDir)) {
                    fs.mkdirSync(brandsDir, { recursive: true });
                }
                cb(null, brandsDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = `brand-${timestamp}-${randomSuffix}${ext}`;
                cb(null, filename);
            }
        });
        return (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024,
                fieldSize: 10 * 1024 * 1024,
                fieldNameSize: 100,
                fields: 50
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                }
                else {
                    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
                }
            }
        });
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=storageService.js.map