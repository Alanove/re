import * as path from 'path';

/**
 * Project root: depends on where this file lives on disk, not NODE_ENV.
 * - `ts-node` loads from `src/constants` → two levels up to root.
 * - `node dist/...` loads from `dist/src/constants` → three levels up.
 *
 * Using NODE_ENV here breaks scripts run as `NODE_ENV=production ts-node ...`:
 * they still execute from `src/`, but were wrongly treated as `dist/` and
 * resolved PUBLIC_DIR to the parent of the project (no uploads found).
 */
const getBaseDir = () => {
  const parts = __dirname.replace(/\\/g, '/').split('/');
  const isCompiledOutput = parts.includes('dist');
  return isCompiledOutput
    ? path.resolve(__dirname, '../../../')
    : path.resolve(__dirname, '../../');
};

const BASE_DIR = getBaseDir();

/**
 * Data paths configuration
 * All paths are absolute and work in both development and production
 */
export const DATA_PATHS = {
  // Root directory (project root)
  ROOT_DIR: BASE_DIR,
  
  // Data directory (absolute paths)
  DATA_DIR: path.resolve(BASE_DIR, 'data'),
  PAGES_FILE: path.resolve(BASE_DIR, 'data/pages.json'),
  SITE_SETTINGS_FILE: path.resolve(BASE_DIR, 'data/site-settings.json'),
  USERS_FILE: path.resolve(BASE_DIR, 'data/users.json'),
  ADMIN_MENU_FILE: path.resolve(BASE_DIR, 'data/admin-menu.json'),
  THEME_CONFIG_FILE: path.resolve(BASE_DIR, 'data/theme-config.json'),
  SLIDER_FILE: path.resolve(BASE_DIR, 'data/slider.json'),
  PROJECTS_FILE: path.resolve(BASE_DIR, 'data/projects.json'),
  CLIENTS_FILE: path.resolve(BASE_DIR, 'data/clients.json'),
  PROJECT_ANALYTICS_FILE: path.resolve(BASE_DIR, 'data/project_analytics.json'),
  PROJECT_PHOTOS_FILE: path.resolve(BASE_DIR, 'data/project-photos.json'),
  MENU_FILE: path.resolve(BASE_DIR, 'data/menu.json'),
  
  // Public directories (absolute paths)
  PUBLIC_DIR: path.resolve(BASE_DIR, 'public'),
  IMAGES_DIR: path.resolve(BASE_DIR, 'public/images'),
  SLIDER_DIR: path.resolve(BASE_DIR, 'public/images/slide'),
  HOMEPAGE_DIR: path.resolve(BASE_DIR, 'public/images/homepage'),
  PAGES_DIR: path.resolve(BASE_DIR, 'public/pages'),
  TEMP_DIR: path.resolve(BASE_DIR, 'public/temp'),
  DOWNLOADS_DIR: path.resolve(BASE_DIR, 'public/downloads'),
  
  // Admin-specific directories (absolute paths)
  ADMIN_DIR: path.resolve(BASE_DIR, 'admin'),
  ADMIN_PUBLIC_DIR: path.resolve(BASE_DIR, 'admin/public'),
  ADMIN_IMAGES_DIR: path.resolve(BASE_DIR, 'admin/public/images'),
  ADMIN_PAGES_DIR: path.resolve(BASE_DIR, 'admin/public/pages'),
  ADMIN_TEMP_DIR: path.resolve(BASE_DIR, 'admin/public/temp'),
  
  // Quill editor uploads (absolute paths)
  QUILL_UPLOADS_DIR: path.resolve(BASE_DIR, 'public/images/quill-uploads'),
  
  // Project-related directories (absolute paths)
  PROJECTS_DIR: path.resolve(BASE_DIR, 'public/projects'),
  
} as const;

/**
 * Helper function to get data file path
 * @param filename - The filename in the data directory
 * @returns Full absolute path to the data file
 */
export function getDataFilePath(filename: string): string {
  return path.resolve(DATA_PATHS.DATA_DIR, filename);
}

/**
 * Helper function to get public file path
 * @param relativePath - The relative path from public directory
 * @returns Full absolute path to the public file
 */
export function getPublicFilePath(relativePath: string): string {
  return path.resolve(DATA_PATHS.PUBLIC_DIR, relativePath);
}

/**
 * Helper function to get admin public file path
 * @param relativePath - The relative path from admin public directory
 * @returns Full absolute path to the admin public file
 */
export function getAdminPublicFilePath(relativePath: string): string {
  return path.resolve(DATA_PATHS.ADMIN_PUBLIC_DIR, relativePath);
}

/**
 * Helper function to get page-specific file path
 * @param pageKey - The page key
 * @param filename - The filename within the page directory
 * @returns Full absolute path to the page-specific file
 */
export function getPageFilePath(pageKey: string, filename: string): string {
  return path.resolve(DATA_PATHS.PAGES_DIR, pageKey, filename);
}

/**
 * Helper function to get page editor file path
 * @param pageKey - The page key
 * @param filename - The filename within the page editor directory
 * @returns Full absolute path to the page editor file
 */
export function getPageEditorFilePath(pageKey: string, filename: string): string {
  return path.resolve(DATA_PATHS.PAGES_DIR, pageKey, 'editor', filename);
}

/**
 * Helper function to get page directory path
 * @param pageKey - The page key
 * @returns Full absolute path to the page directory
 */
export function getPageDirPath(pageKey: string): string {
  return path.resolve(DATA_PATHS.PAGES_DIR, pageKey);
}

/**
 * Helper function to get page editor directory path
 * @param pageKey - The page key
 * @returns Full absolute path to the page editor directory
 */
export function getPageEditorDirPath(pageKey: string): string {
  return path.resolve(DATA_PATHS.PAGES_DIR, pageKey, 'editor');
}

/**
 * Helper function to convert absolute path to public URL
 * @param absolutePath - The absolute file path
 * @returns Public URL for the file
 */
export function getPublicUrl(absolutePath: string): string {
  // Normalize path separators (Windows backslashes to forward slashes)
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  const normalizedPublicDir = DATA_PATHS.PUBLIC_DIR.replace(/\\/g, '/');
  
  // Remove the public directory prefix to get the relative path
  let relativePath = normalizedPath.replace(normalizedPublicDir, '');
  
  // Ensure the path starts with a forward slash
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }
  
  // Normalize multiple slashes
  relativePath = relativePath.replace(/\/+/g, '/');
  
  return relativePath;
}

/**
 * Helper function to get project image URL
 * @param projectName - The project folder name
 * @param imageName - The image filename
 * @returns Public URL for the project image
 */
export function getProjectImageUrl(projectName: string, imageName: string): string {
  return `/projects/${projectName}/${imageName}`;
}

/**
 * Helper function to get work image URL
 * @param projectName - The project folder name
 * @param workName - The work folder name
 * @param imageName - The image filename
 * @returns Public URL for the work image
 */
export function getWorkImageUrl(projectName: string, workName: string, imageName: string): string {
  return `/projects/${projectName}/${workName}/${imageName}`;
}

/**
 * Helper function to get project directory path
 * @param projectName - The project folder name
 * @returns Full absolute path to the project directory
 */
export function getProjectDirPath(projectName: string): string {
  return path.resolve(DATA_PATHS.PROJECTS_DIR, projectName);
}

/**
 * Helper function to get work directory path
 * @param projectName - The project folder name
 * @param workName - The work folder name
 * @returns Full absolute path to the work directory
 */
export function getWorkDirPath(projectName: string, workName: string): string {
  return path.resolve(DATA_PATHS.PROJECTS_DIR, projectName, workName);
}

/**
 * Absolute disk path for a product's image folder: public/images/products/{productId}/
 */
export function getProductImagesDirPath(productId: number): string {
  return path.resolve(DATA_PATHS.IMAGES_DIR, 'products', String(productId));
}

/**
 * Public URL for a file inside a product image folder.
 */
export function getProductImagePublicUrl(productId: number, filename: string): string {
  const safeName = path.posix.basename(filename.replace(/\\/g, '/'));
  return `/images/products/${productId}/${safeName}`;
}

/**
 * Staging folder for product image uploads before a product id exists (create form).
 */
export function getProductImagesStagingDirPath(): string {
  return path.resolve(DATA_PATHS.IMAGES_DIR, 'products', '_staging');
}
