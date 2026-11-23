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
const fs = __importStar(require("fs"));
const constants_1 = require("../constants");
class ProjectPhotosService {
    constructor() {
        this.dataPath = constants_1.DATA_PATHS.PROJECT_PHOTOS_FILE;
    }
    getProjectPhotos() {
        try {
            const data = fs.readFileSync(this.dataPath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error('Error reading project photos file:', error);
            return {
                categories: {},
                metadata: {
                    totalCategories: 0,
                    totalProjects: 0,
                    totalImages: 0,
                    extractedAt: new Date().toISOString(),
                    sourceDirectory: ''
                }
            };
        }
    }
    getCategories() {
        const data = this.getProjectPhotos();
        return Object.keys(data.categories);
    }
    getProjectsByCategory(category) {
        const data = this.getProjectPhotos();
        return data.categories[category]?.projects || [];
    }
    getProjectBySlug(categorySlug, projectSlug) {
        const data = this.getProjectPhotos();
        for (const category of Object.values(data.categories)) {
            if (category.slug === categorySlug) {
                const project = category.projects.find(p => p.slug === projectSlug);
                return project || null;
            }
        }
        return null;
    }
    getCategoryBySlug(categorySlug) {
        const data = this.getProjectPhotos();
        for (const category of Object.values(data.categories)) {
            if (category.slug === categorySlug) {
                return category;
            }
        }
        return null;
    }
    getProjectsByCategorySlug(categorySlug) {
        const category = this.getCategoryBySlug(categorySlug);
        return category?.projects || [];
    }
    searchProjects(query) {
        const data = this.getProjectPhotos();
        const results = [];
        const searchTerm = query.toLowerCase();
        for (const category of Object.values(data.categories)) {
            const matchingProjects = category.projects.filter(project => project.name.toLowerCase().includes(searchTerm));
            results.push(...matchingProjects);
        }
        return results;
    }
    getProjectsByExtension(extension) {
        const data = this.getProjectPhotos();
        const results = [];
        const ext = extension.toLowerCase();
        for (const category of Object.values(data.categories)) {
            const matchingProjects = category.projects.filter(project => project.fileExtension.toLowerCase() === ext);
            results.push(...matchingProjects);
        }
        return results;
    }
    getStatistics() {
        const data = this.getProjectPhotos();
        const stats = {
            totalCategories: data.metadata.totalCategories,
            totalProjects: data.metadata.totalProjects,
            totalImages: data.metadata.totalImages,
            categories: {},
            fileExtensions: {},
            totalFileSize: 0
        };
        for (const category of Object.values(data.categories)) {
            stats.categories[category.name] = category.totalProjects;
            for (const project of category.projects) {
                stats.totalFileSize += project.fileSize;
                stats.fileExtensions[project.fileExtension] = (stats.fileExtensions[project.fileExtension] || 0) + 1;
            }
        }
        return stats;
    }
}
exports.default = new ProjectPhotosService();
//# sourceMappingURL=projectPhotosService.js.map