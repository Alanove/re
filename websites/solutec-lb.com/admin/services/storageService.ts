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
  private newsDir: string;
  private imagesDir: string;
  private sliderDir: string;
  private clientsDir: string;
  private videosDir: string;

  private constructor() {
    this.tempDir = DATA_PATHS.TEMP_DIR;
    this.pagesDir = DATA_PATHS.PAGES_DIR;
    this.newsDir = DATA_PATHS.NEWS_DIR;
    this.imagesDir = DATA_PATHS.IMAGES_DIR;
    this.sliderDir = DATA_PATHS.SLIDER_DIR;
    this.clientsDir = path.join(DATA_PATHS.IMAGES_DIR, 'clients');
    this.videosDir = DATA_PATHS.VIDEOS_DIR;
    
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
  const directories = [this.tempDir, this.pagesDir, this.newsDir, this.imagesDir, this.sliderDir, this.clientsDir, this.videosDir];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Get default site logo from site settings
   */
  public getDefaultLogo(): string {
    const siteSettings = siteSettingsService.getAllSettings();
    return siteSettings.logo || '/images/logo.jpg';
  }

  /**
   * Create multer configuration for page uploads
   */
  public createPageUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = req.params['key'] || req.body.key || 'temp';
        
        // Create page-specific directory
        const pageDir = path.join(this.pagesDir, pageKey);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }
        cb(null, pageDir);
      },
      filename: (req, file, cb) => {
        // Get page key from URL params or body
        let pageKey = req.params['key'] || req.body.key || 'temp';
        
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
        fileSize: 5 * 1024 * 1024, // 5MB file size limit
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
   * Create multer configuration for news uploads
   */
  public createNewsUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get news key from URL params or body
        let newsKey = req.params['key'] || req.body.key || 'temp';
        
        // Create news-specific directory
        const newsDir = path.join(this.newsDir, newsKey);
        if (!fs.existsSync(newsDir)) {
          fs.mkdirSync(newsDir, { recursive: true });
        }
        cb(null, newsDir);
      },
      filename: (req, file, cb) => {
        // Get news key from URL params or body
        let newsKey = req.params['key'] || req.body.key || 'temp';
        
        // Use news key and image type for naming
        const ext = path.extname(file.originalname);
        let filename;
        
        if (file.fieldname === 'seoImageFile') {
          filename = `${newsKey}-seo${ext}`;
        } else if (file.fieldname === 'pagePicture') {
          filename = `${newsKey}-default${ext}`;
        } else {
          // Fallback for other file types
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          filename = `${newsKey}-${file.fieldname}-${uniqueSuffix}${ext}`;
        }
        
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB file size limit
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
   * Create multer configuration for slider uploads
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
        fileSize: 10 * 1024 * 1024, // 10MB file size limit for slider images
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
   * Create multer configuration for clients logo/image uploads
   */
  public createClientsUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(this.clientsDir)) {
          fs.mkdirSync(this.clientsDir, { recursive: true });
        }
        cb(null, this.clientsDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `client-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for editor uploads
   */
  public createEditorUploadConfig(): multer.Multer {
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
        const filename = `editor-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB file size limit
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
   * Create multer configuration for video uploads
   */
  public createVideoUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Ensure videos directory exists
        if (!fs.existsSync(this.videosDir)) {
          fs.mkdirSync(this.videosDir, { recursive: true });
        }
        cb(null, this.videosDir);
      },
      filename: (req, file, cb) => {
        // Keep original filename but ensure uniqueness
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const filename = `${name}-${timestamp}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB file size limit for videos
      },
      fileFilter: (req, file, cb) => {
        // Check file type for videos
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error('Only video files are allowed'));
        }
      }
    });
  }

  /**
   * Create multer configuration for file uploads (all file types)
   */
  public createFileUploadConfig(): multer.Multer {
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
        const filename = `file-${timestamp}-${randomSuffix}${ext}`;
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
      }
      // No fileFilter - accept all file types
    });
  }
} 