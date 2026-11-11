import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DATA_PATHS, getPublicUrl, getPageEditorDirPath, getApartmentDirPath } from '../../src/constants';
import { APARTMENT_PHOTO_MAX_FILE_SIZE } from '../../src/services/imageService';
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
  private apartmentsDir: string;
  private contactUploadsDir: string;

  private constructor() {
    this.tempDir = DATA_PATHS.TEMP_DIR;
    this.pagesDir = DATA_PATHS.PAGES_DIR;
    this.imagesDir = DATA_PATHS.IMAGES_DIR;
    this.sliderDir = DATA_PATHS.SLIDER_DIR;
    this.apartmentsDir = DATA_PATHS.APARTMENTS_DIR;
    this.contactUploadsDir = DATA_PATHS.CONTACT_UPLOADS_DIR;
    
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
    const directories = [
      this.tempDir,
      this.pagesDir,
      this.imagesDir,
      this.sliderDir,
      this.apartmentsDir,
      this.contactUploadsDir,
      DATA_PATHS.DOWNLOADS_DIR,
      DATA_PATHS.RECEIPTS_UPLOADS_DIR,
      DATA_PATHS.QUILL_UPLOADS_DIR,
      DATA_PATHS.PROJECTS_DIR,
      path.join(DATA_PATHS.IMAGES_DIR, 'generic')
    ];
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
        
        // Unique names so re-uploads aren't stuck behind browser cache
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        let filename;
        
        if (file.fieldname === 'seoImageFile') {
          filename = `${pageKey}-seo-${uniqueSuffix}${ext}`;
        } else if (file.fieldname === 'pagePicture') {
          filename = `${pageKey}-default-${uniqueSuffix}${ext}`;
        } else {
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
   * Create multer configuration for apartment uploads
   */
  public createApartmentUploadConfig(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        // Get apartment ID from URL params
        const apartmentId = req.params['id'] || req.body.apartmentId;
        if (!apartmentId) {
          return cb(new Error('Apartment ID is required'), '');
        }
        
        // Create apartment-specific directory
        const apartmentDir = getApartmentDirPath(parseInt(apartmentId));
        if (!fs.existsSync(apartmentDir)) {
          fs.mkdirSync(apartmentDir, { recursive: true });
        }
        cb(null, apartmentDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `apartment-${timestamp}-${randomSuffix}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: APARTMENT_PHOTO_MAX_FILE_SIZE,
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
   * Create multer configuration for contact form attachments (site map photos).
   */
  public createContactUploadConfig(): multer.Multer {
    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(this.contactUploadsDir)) {
          fs.mkdirSync(this.contactUploadsDir, { recursive: true });
        }
        cb(null, this.contactUploadsDir);
      },
      filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1e9);
        const rawExt = path.extname(file.originalname).toLowerCase();
        const ext = allowedExt.has(rawExt)
          ? rawExt
          : file.mimetype === 'image/png'
            ? '.png'
            : file.mimetype === 'image/webp'
              ? '.webp'
              : '.jpg';
        cb(null, `contact-${timestamp}-${randomSuffix}${ext}`);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024
      },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedMime.has(file.mimetype) && allowedExt.has(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Only JPG, PNG, or WebP images are allowed for the site map photo'));
        }
      }
    });
  }
} 