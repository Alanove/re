import multer from 'multer';
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
export declare class StorageService {
    private static instance;
    private tempDir;
    private pagesDir;
    private imagesDir;
    private sliderDir;
    private homepageDir;
    private constructor();
    static getInstance(): StorageService;
    private ensureDirectories;
    getDefaultLogo(): Promise<string>;
    saveBrandLogo(file: Express.Multer.File): Promise<string>;
    createPageUploadConfig(): multer.Multer;
    createSliderUploadConfig(): multer.Multer;
    createHomepageBannerUploadConfig(): multer.Multer;
    createQuillUploadConfig(): multer.Multer;
    createPageGalleryUploadConfig(): multer.Multer;
    createPageFileUploadConfig(): multer.Multer;
    moveFile(fromPath: string, toPath: string): void;
    deleteFile(filePath: string): boolean;
    deleteDirectory(dirPath: string): boolean;
    getFileInfo(filePath: string): {
        exists: boolean;
        size?: number;
        modified?: Date;
    };
    createPageEditorDirectory(pageKey: string): string;
    generateEditorFilename(originalname: string): string;
    getPublicUrl(filePath: string): string;
    private resolveProductUploadDestination;
    createProductImageUploadConfig(): multer.Multer;
    createProductImagesUploadConfig(): multer.Multer;
    createCategoryUploadConfig(): multer.Multer;
    createBrandUploadConfig(): multer.Multer;
}
//# sourceMappingURL=storageService.d.ts.map