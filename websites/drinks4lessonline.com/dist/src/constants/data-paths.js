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
exports.DATA_PATHS = void 0;
exports.getDataFilePath = getDataFilePath;
exports.getPublicFilePath = getPublicFilePath;
exports.getAdminPublicFilePath = getAdminPublicFilePath;
exports.getPageFilePath = getPageFilePath;
exports.getPageEditorFilePath = getPageEditorFilePath;
exports.getPageDirPath = getPageDirPath;
exports.getPageEditorDirPath = getPageEditorDirPath;
exports.getPublicUrl = getPublicUrl;
exports.getProjectImageUrl = getProjectImageUrl;
exports.getWorkImageUrl = getWorkImageUrl;
exports.getProjectDirPath = getProjectDirPath;
exports.getWorkDirPath = getWorkDirPath;
exports.getProductImagesDirPath = getProductImagesDirPath;
exports.getProductImagePublicUrl = getProductImagePublicUrl;
exports.getProductImagesStagingDirPath = getProductImagesStagingDirPath;
const path = __importStar(require("path"));
const getBaseDir = () => {
    const parts = __dirname.replace(/\\/g, '/').split('/');
    const isCompiledOutput = parts.includes('dist');
    return isCompiledOutput
        ? path.resolve(__dirname, '../../../')
        : path.resolve(__dirname, '../../');
};
const BASE_DIR = getBaseDir();
exports.DATA_PATHS = {
    ROOT_DIR: BASE_DIR,
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
    PUBLIC_DIR: path.resolve(BASE_DIR, 'public'),
    IMAGES_DIR: path.resolve(BASE_DIR, 'public/images'),
    SLIDER_DIR: path.resolve(BASE_DIR, 'public/images/slide'),
    HOMEPAGE_DIR: path.resolve(BASE_DIR, 'public/images/homepage'),
    PAGES_DIR: path.resolve(BASE_DIR, 'public/pages'),
    TEMP_DIR: path.resolve(BASE_DIR, 'public/temp'),
    DOWNLOADS_DIR: path.resolve(BASE_DIR, 'public/downloads'),
    ADMIN_DIR: path.resolve(BASE_DIR, 'admin'),
    ADMIN_PUBLIC_DIR: path.resolve(BASE_DIR, 'admin/public'),
    ADMIN_IMAGES_DIR: path.resolve(BASE_DIR, 'admin/public/images'),
    ADMIN_PAGES_DIR: path.resolve(BASE_DIR, 'admin/public/pages'),
    ADMIN_TEMP_DIR: path.resolve(BASE_DIR, 'admin/public/temp'),
    QUILL_UPLOADS_DIR: path.resolve(BASE_DIR, 'public/images/quill-uploads'),
    PROJECTS_DIR: path.resolve(BASE_DIR, 'public/projects'),
};
function getDataFilePath(filename) {
    return path.resolve(exports.DATA_PATHS.DATA_DIR, filename);
}
function getPublicFilePath(relativePath) {
    return path.resolve(exports.DATA_PATHS.PUBLIC_DIR, relativePath);
}
function getAdminPublicFilePath(relativePath) {
    return path.resolve(exports.DATA_PATHS.ADMIN_PUBLIC_DIR, relativePath);
}
function getPageFilePath(pageKey, filename) {
    return path.resolve(exports.DATA_PATHS.PAGES_DIR, pageKey, filename);
}
function getPageEditorFilePath(pageKey, filename) {
    return path.resolve(exports.DATA_PATHS.PAGES_DIR, pageKey, 'editor', filename);
}
function getPageDirPath(pageKey) {
    return path.resolve(exports.DATA_PATHS.PAGES_DIR, pageKey);
}
function getPageEditorDirPath(pageKey) {
    return path.resolve(exports.DATA_PATHS.PAGES_DIR, pageKey, 'editor');
}
function getPublicUrl(absolutePath) {
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    const normalizedPublicDir = exports.DATA_PATHS.PUBLIC_DIR.replace(/\\/g, '/');
    let relativePath = normalizedPath.replace(normalizedPublicDir, '');
    if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
    }
    relativePath = relativePath.replace(/\/+/g, '/');
    return relativePath;
}
function getProjectImageUrl(projectName, imageName) {
    return `/projects/${projectName}/${imageName}`;
}
function getWorkImageUrl(projectName, workName, imageName) {
    return `/projects/${projectName}/${workName}/${imageName}`;
}
function getProjectDirPath(projectName) {
    return path.resolve(exports.DATA_PATHS.PROJECTS_DIR, projectName);
}
function getWorkDirPath(projectName, workName) {
    return path.resolve(exports.DATA_PATHS.PROJECTS_DIR, projectName, workName);
}
function getProductImagesDirPath(productId) {
    return path.resolve(exports.DATA_PATHS.IMAGES_DIR, 'products', String(productId));
}
function getProductImagePublicUrl(productId, filename) {
    const safeName = path.posix.basename(filename.replace(/\\/g, '/'));
    return `/images/products/${productId}/${safeName}`;
}
function getProductImagesStagingDirPath() {
    return path.resolve(exports.DATA_PATHS.IMAGES_DIR, 'products', '_staging');
}
//# sourceMappingURL=data-paths.js.map