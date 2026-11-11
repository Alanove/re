import * as path from 'path';

// Use compiled output location, not NODE_ENV (dev can load .env files that set production).
const getBaseDir = () => {
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../../../');
  }
  return path.resolve(__dirname, '../../');
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
  HERO_SECTION_FILE: path.resolve(BASE_DIR, 'data/hero-section.json'),
  CONTACT_INFO_FILE: path.resolve(BASE_DIR, 'data/contact-info.json'),
  CAREERS_FILE: path.resolve(BASE_DIR, 'data/careers.json'),
  NEWS_FILE: path.resolve(BASE_DIR, 'data/news.json'),
  
  // Public directories (absolute paths)
  PUBLIC_DIR: path.resolve(BASE_DIR, 'public'),
  IMAGES_DIR: path.resolve(BASE_DIR, 'public/images'),
  SLIDER_DIR: path.resolve(BASE_DIR, 'public/images/slide'),
  VIDEOS_DIR: path.resolve(BASE_DIR, 'public/videos'),
  PAGES_DIR: path.resolve(BASE_DIR, 'public/pages'),
  NEWS_DIR: path.resolve(BASE_DIR, 'public/news'),
  TEMP_DIR: path.resolve(BASE_DIR, 'public/temp'),
  FORM_UPLOADS_DIR: path.resolve(BASE_DIR, 'public/temp/form-uploads'),
  DOWNLOADS_DIR: path.resolve(BASE_DIR, 'public/downloads'),
  
  // Admin-specific directories (absolute paths)
  ADMIN_DIR: path.resolve(BASE_DIR, 'admin'),
  ADMIN_PUBLIC_DIR: path.resolve(BASE_DIR, 'admin/public'),
  ADMIN_IMAGES_DIR: path.resolve(BASE_DIR, 'admin/public/images'),
  ADMIN_PAGES_DIR: path.resolve(BASE_DIR, 'admin/public/pages'),
  ADMIN_TEMP_DIR: path.resolve(BASE_DIR, 'admin/public/temp'),
  
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
  // Remove the public directory prefix to get the relative path
  const relativePath = absolutePath.replace(DATA_PATHS.PUBLIC_DIR, '');
  
  // Ensure the path starts with a forward slash
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
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