import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DATA_PATHS, getPublicUrl, getPageEditorDirPath } from '../../src/constants';
import { SiteSettingsService } from './siteSettingsService';

const siteSettingsService = SiteSettingsService.getInstance();

export interface FileUploadConfig {
  destination: string;
  filename: string;
  limits?: {
    fileSize?: number;
  };
  allowedMimeTypes?: string[];
}

export interface UploadedFile {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export class StorageService {
  private static instance: StorageService;
  private tempDir: string;
  private pagesDir: string;
  private imagesDir: string;
  private sliderDir: string;
  private homeContentDir: string;

  private constructor() {
    this.tempDir = DATA_PATHS.TEMP_DIR;
    this.pagesDir = DATA_PATHS.PAGES_DIR;
    this.imagesDir = DATA_PATHS.IMAGES_DIR;
    this.sliderDir = DATA_PATHS.SLIDER_DIR;
    this.homeContentDir = DATA_PATHS.HOME_CONTENT_DIR;

    // Ensure directories exist
    this.ensureDirectories();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const directories = [this.tempDir, this.pagesDir, this.imagesDir, this.sliderDir, this.homeContentDir];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Get default site logo from site settings
   */
  public async getDefaultLogo(): Promise<string> {
    const siteSettings = await siteSettingsService.getAllSettings();
    return siteSettings.logo || '/images/logo.jpg';
  }

  /**
   * Save brand logo and return public URL
   */
  public async saveBrandLogo(file: Express.Multer.File): Promise<string> {
    return getPublicUrl(file.path);
  }

  /**
   * Create multer configuration for page uploads
   */
  public createPageUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = (req.params['key'] as string) || req.body.key || 'temp';

        // Create page-specific directory
        const pageDir = path.join(this.pagesDir, pageKey);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }
        cb(null, pageDir);
      },
      filename: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = (req.params['key'] as string) || req.body.key || 'temp';

        // Use page key and image type for naming
        const ext = path.extname(file.originalname);
        let filename;

        if (file.fieldname === 'seoImageFile') {
          filename = `${pageKey}-seo${ext}`;
        } else if (file.fieldname === 'pagePicture') {
          filename = `${pageKey}-default${ext}`;
        } else {
          // Fallback for other file types
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          filename = `${pageKey}-${file.fieldname}-${uniqueSuffix}${ext}`;
        }

        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB file size limit
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });
  }

  /**
   * Homepage content uploads (poster image, bridal video, video poster).
   */
  public createHomeContentMediaUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(this.homeContentDir)) {
          fs.mkdirSync(this.homeContentDir, { recursive: true });
        }
        cb(null, this.homeContentDir);
      },
      filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const prefix = file.fieldname === 'bridal_video' ? 'home-bridal-video' : 'home-content';
        cb(null, `${prefix}-${timestamp}-${randomSuffix}${ext}`);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 100 * 1024 * 1024,
        fieldSize: 2 * 1024 * 1024,
        fieldNameSize: 100,
        fields: 80
      },
      fileFilter: (_req, file, cb) => {
        if (file.fieldname === 'bridal_video') {
          if (file.mimetype.startsWith('video/')) {
            cb(null, true);
          } else {
            cb(new Error('Bridal video must be a video file (MP4 recommended)'));
          }
          return;
        }
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed for poster uploads'));
        }
      }
    });
  }

  /** @deprecated Use createHomeContentMediaUploadConfig */
  public createHomeContentPosterUploadConfig(): multer.Multer {
    return this.createHomeContentMediaUploadConfig();
  }

  /**
   * Create multer configuration for slider uploads (images and videos)
   */
  public createSliderUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Use slider directory
        if (!fs.existsSync(this.sliderDir)) {
          fs.mkdirSync(this.sliderDir, { recursive: true });
        }
        cb(null, this.sliderDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename with UUID-like format
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB file size limit for slider media (images and videos)
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Check file type - accept images and videos
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

        if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPEG, PNG, GIF, WebP) and video files (MP4, WebM, OGG, MOV) are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for Quill editor uploads
   */
  public createQuillUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Use temp directory initially, will be moved later
        if (!fs.existsSync(this.tempDir)) {
          fs.mkdirSync(this.tempDir, { recursive: true });
        }
        cb(null, this.tempDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `quill-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB file size limit
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for page photo gallery uploads
   * This handles multiple photo uploads for page galleries
   */
  public createPageGalleryUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get page key from URL params
        let pageKey = (req.params['key'] as string) || 'temp';

        // Create page gallery directory
        const galleryDir = path.join(this.pagesDir, pageKey, 'gallery');
        if (!fs.existsSync(galleryDir)) {
          fs.mkdirSync(galleryDir, { recursive: true });
        }
        cb(null, galleryDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename for gallery photos
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `photo-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB file size limit per file
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50, // Maximum number of fields
        files: 100 // Maximum number of files (increased for large batch uploads)
      },
      fileFilter: (req, file, cb) => {
        // Check file type - only images allowed
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for page file uploads (all file types)
   * This handles file uploads for page content (PDFs, documents, etc.)
   */
  public createPageFileUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = (req.params['key'] as string) || req.body.key || 'temp';

        // Create page-specific directory
        const pageDir = path.join(this.pagesDir, pageKey);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }
        cb(null, pageDir);
      },
      filename: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = (req.params['key'] as string) || req.body.key || 'temp';

        // Generate unique filename preserving original name
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        // Sanitize filename to remove special characters
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${sanitizedBaseName}-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB file size limit
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Accept all file types for page file uploads
        cb(null, true);
      }
    });
  }

  /**
   * Move file from temp location to final destination
   */
  public moveFile(fromPath: string, toPath: string): void {
    // Ensure destination directory exists
    const destDir = path.dirname(toPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(fromPath, toPath);
  }

  /**
   * Delete file if it exists
   */
  public deleteFile(filePath: string): boolean {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Delete directory and all its contents
   */
  public deleteDirectory(dirPath: string): boolean {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  /**
   * Get file info
   */
  public getFileInfo(filePath: string): { exists: boolean; size?: number; modified?: Date } {
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

  /**
   * Create page-specific editor directory
   */
  public createPageEditorDirectory(pageKey: string): string {
    const editorDir = getPageEditorDirPath(pageKey);
    if (!fs.existsSync(editorDir)) {
      fs.mkdirSync(editorDir, { recursive: true });
    }
    return editorDir;
  }

  /**
   * Generate unique filename for editor uploads
   */
  public generateEditorFilename(originalname: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const ext = path.extname(originalname);
    return `editor-${timestamp}-${randomSuffix}${ext}`;
  }

  /**
   * Get public URL for a file
   */
  public getPublicUrl(filePath: string): string {
    return getPublicUrl(filePath);
  }

  /**
   * Create multer configuration for product image uploads (single file)
   */
  public createProductImageUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Use images directory for product images
        if (!fs.existsSync(this.imagesDir)) {
          fs.mkdirSync(this.imagesDir, { recursive: true });
        }
        cb(null, this.imagesDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename for product images
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `product-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB file size limit
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Check file type - only images allowed
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for multiple product image uploads
   */
  public createProductImagesUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Use images directory for product images
        if (!fs.existsSync(this.imagesDir)) {
          fs.mkdirSync(this.imagesDir, { recursive: true });
        }
        cb(null, this.imagesDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename for product images
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `product-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB file size limit per file
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50, // Maximum number of fields
        files: 20 // Maximum number of files
      },
      fileFilter: (req, file, cb) => {
        // Check file type - only images allowed
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for category image and video uploads
   */
  public createCategoryUploadConfig(): multer.Multer {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const isVideo = file.fieldname === 'video';
        const categoriesDir = isVideo
          ? path.join(this.imagesDir, 'categories', 'videos')
          : path.join(this.imagesDir, 'categories');
        if (!fs.existsSync(categoriesDir)) {
          fs.mkdirSync(categoriesDir, { recursive: true });
        }
        cb(null, categoriesDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const prefix = file.fieldname === 'video' ? 'category-video' : 'category';
        cb(null, `${prefix}-${timestamp}-${randomSuffix}${ext}`);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024,
        fieldNameSize: 100,
        fields: 50,
        files: 2
      },
      fileFilter: (req, file, cb) => {
        if (file.fieldname === 'video') {
          if (allowedVideoTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only video files (MP4, WebM, OGG, MOV) are allowed'));
          }
          return;
        }
        if (allowedImageTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for brand logo uploads
   */
  public createBrandUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Use images/brands directory for brand images
        const brandsDir = path.join(this.imagesDir, 'brands');
        if (!fs.existsSync(brandsDir)) {
          fs.mkdirSync(brandsDir, { recursive: true });
        }
        cb(null, brandsDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename for brand images
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `brand-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB file size limit
        fieldSize: 10 * 1024 * 1024, // 10MB field size limit for text fields
        fieldNameSize: 100, // 100 bytes for field name
        fields: 50 // Maximum number of fields
      },
      fileFilter: (req, file, cb) => {
        // Check file type - only images allowed
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
        }
      }
    });
  }

} 