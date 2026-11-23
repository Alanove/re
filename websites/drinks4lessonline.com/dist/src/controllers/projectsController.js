"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showProjects = showProjects;
exports.showProjectDetail = showProjectDetail;
const projectsService_1 = __importDefault(require("../services/projectsService"));
const pagesService_1 = __importDefault(require("../services/pagesService"));
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
async function showProjects(req, res) {
    try {
        const categoryUrl = req.params['category'];
        const countryUrl = req.params['country'];
        const filteredProjects = await projectsService_1.default.getFilteredProjects({ categoryUrl, countryUrl });
        const categories = await projectsService_1.default.getCategories();
        const countries = await projectsService_1.default.getCountries();
        const siteSettings = await siteSettingsService.getAllSettings();
        const siteTitle = siteSettings.siteTitle || 'CMS';
        let seoData = pagesService_1.default.getSeoData('projects', {
            pageUrl: `${pagesService_1.default.getSiteData().domain}${req.path}`
        });
        if (categoryUrl) {
            const category = categories.find(cat => cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === categoryUrl);
            if (category) {
                seoData = pagesService_1.default.getSeoData('projects', {
                    pageTitle: `${category} Steel Construction Projects - ${siteTitle}`,
                    pageDescription: `Explore our ${category.toLowerCase()} steel construction projects. View our portfolio of ${category.toLowerCase()} projects including structural steel, architectural steelwork, and industrial facilities.`,
                    pageKeywords: `${category.toLowerCase()}, steel construction, ${category.toLowerCase()} projects, structural steel, architectural steelwork, construction portfolio`,
                    pageUrl: `${pagesService_1.default.getSiteData().domain}${req.path}`,
                    pageImage: '/images/projects.png',
                    pageType: 'website'
                });
            }
        }
        if (countryUrl) {
            const country = countries.find(c => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === countryUrl);
            if (country) {
                seoData = pagesService_1.default.getSeoData('projects', {
                    pageTitle: `Steel Construction Projects in ${country} - ${siteTitle}`,
                    pageDescription: `Explore our steel construction projects in ${country}. View our portfolio of commercial buildings, industrial facilities, and architectural steelwork projects in ${country}.`,
                    pageKeywords: `${country}, steel construction, construction projects, ${country} projects, structural steel, architectural steelwork`,
                    pageUrl: `${pagesService_1.default.getSiteData().domain}${req.path}`,
                    pageImage: '/images/projects.png',
                    pageType: 'website'
                });
            }
        }
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": seoData.pageTitle,
            "description": seoData.pageDescription,
            "numberOfItems": filteredProjects.length,
            "itemListElement": filteredProjects.map((project, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "CreativeWork",
                    "name": project.title,
                    "description": project.description || `${project.title} steel construction project`,
                    "url": `${pagesService_1.default.getSiteData().domain}/projects/${project.url || project.slug}`,
                    "image": `${pagesService_1.default.getSiteData().domain}${projectsService_1.default.getProjectImagePath(project)}`
                }
            }))
        };
        res.render('projects', {
            projects: { projects: filteredProjects },
            categories,
            countries,
            selectedCategory: categoryUrl,
            selectedCountry: countryUrl,
            bodyClass: res.locals.bodyClass + ' dark-theme',
            ...seoData,
            structuredData: JSON.stringify(structuredData),
            projectsService: projectsService_1.default,
            siteData: pagesService_1.default.getSiteData(),
            siteSettings: siteSettings
        });
    }
    catch (error) {
        console.error('Error in showProjects:', error);
        res.status(500).send('Internal Server Error');
    }
}
async function showProjectDetail(req, res) {
    try {
        const project = await projectsService_1.default.getProjectByUrl(req.params['projectUrl'] || '');
        const categories = await projectsService_1.default.getCategories();
        const countries = await projectsService_1.default.getCountries();
        const siteSettings = await siteSettingsService.getAllSettings();
        const siteTitle = siteSettings.siteTitle || 'CMS';
        if (!project) {
            const seoData = pagesService_1.default.getSeoData('home', {
                pageTitle: `Project Not Found - ${siteTitle}`,
                pageDescription: 'The requested steel construction project could not be found.',
                pageKeywords: 'project not found, 404',
                pageUrl: `${pagesService_1.default.getSiteData().domain}${req.path}`,
                pageImage: pagesService_1.default.getSiteData().logo,
                pageType: 'website',
                pageRobots: 'noindex, nofollow'
            });
            return res.status(404).render('404', seoData);
        }
        const seoData = pagesService_1.default.getSeoData('projects', {
            pageTitle: `${project.title} - Steel Construction Project | ${siteTitle}`,
            pageDescription: project.description || `${project.title} steel construction project by ${siteTitle}. View details, specifications, and images of this project.`,
            pageKeywords: `${project.title}, steel construction, construction project, structural steel, architectural steelwork`,
            pageUrl: `${pagesService_1.default.getSiteData().domain}/projects/${project.url || project.slug}`,
            pageImage: projectsService_1.default.getProjectImagePath(project),
            pageType: 'article'
        });
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            "name": project.title,
            "description": seoData.pageDescription,
            "url": seoData.pageUrl,
            "image": `${pagesService_1.default.getSiteData().domain}${projectsService_1.default.getProjectImagePath(project)}`,
            "author": {
                "@type": "Organization",
                "name": pagesService_1.default.getSiteData().name
            },
            "publisher": {
                "@type": "Organization",
                "name": pagesService_1.default.getSiteData().name,
                "logo": {
                    "@type": "ImageObject",
                    "url": `${pagesService_1.default.getSiteData().domain}${pagesService_1.default.getSiteData().logo}`
                }
            },
            "datePublished": project.year || "2024",
            "genre": "",
            "keywords": seoData.pageKeywords
        };
        res.render('project', {
            project,
            categories,
            countries,
            bodyClass: res.locals.bodyClass + ' dark-theme',
            ...seoData,
            structuredData: JSON.stringify(structuredData),
            projectsService: projectsService_1.default,
            siteData: pagesService_1.default.getSiteData(),
            siteSettings: siteSettings
        });
    }
    catch (error) {
        console.error('Error in showProjectDetail:', error);
        res.status(500).send('Internal Server Error');
    }
}
//# sourceMappingURL=projectsController.js.map