"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsService = exports.ProjectsService = void 0;
const projectsService_1 = require("../../admin/services/projectsService");
const adminProjectsService = projectsService_1.ProjectsService.getInstance();
class ProjectsService {
    static getInstance() {
        if (!ProjectsService.instance) {
            ProjectsService.instance = new ProjectsService();
        }
        return ProjectsService.instance;
    }
    async getAllProjects() {
        return await adminProjectsService.getPublishedProjects();
    }
    async getProjectBySlug(slug) {
        const project = await adminProjectsService.getProjectBySlug(slug);
        if (project && project.status === 'published') {
            return project;
        }
        return null;
    }
    async getProjectById(id) {
        const project = await adminProjectsService.getProjectById(id);
        if (project && project.status === 'published') {
            return project;
        }
        return null;
    }
    async getProjects() {
        const projects = await this.getAllProjects();
        return { projects };
    }
    async getCountries() {
        const projects = await this.getAllProjects();
        const countries = [...new Set(projects.map(p => p.country).filter(c => c))];
        return countries;
    }
    async getCategories() {
        const projects = await this.getAllProjects();
        const categories = [...new Set(projects.flatMap(p => p.tags || []))];
        return categories;
    }
    async getFilteredProjects(filters) {
        let projects = await this.getAllProjects();
        if (filters.categoryUrl) {
            projects = projects.filter(p => {
                const tags = p.tags || [];
                return tags.some((tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === filters.categoryUrl);
            });
        }
        if (filters.countryUrl) {
            projects = projects.filter(p => {
                const country = p.country || '';
                return country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === filters.countryUrl;
            });
        }
        return projects;
    }
    async getProjectByUrl(url) {
        const projects = await this.getAllProjects();
        return projects.find(p => {
            if (p.slug === url)
                return true;
            const projectUrl = p.url || p.slug;
            return projectUrl === url;
        }) || null;
    }
    getProjectImagePath(project) {
        return project.featuredImage || '/images/default-project.jpg';
    }
}
exports.ProjectsService = ProjectsService;
exports.projectsService = ProjectsService.getInstance();
exports.default = exports.projectsService;
//# sourceMappingURL=projectsService.js.map