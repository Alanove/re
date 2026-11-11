import { Request, Response } from 'express';
import projectsService from '../services/projectsService';
import pagesService from '../services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { Project } from '../../admin/services/projectsService';

const siteSettingsService = SiteSettingsService.getInstance();

async function showProjects(req: Request, res: Response): Promise<void> {
  try {
    const categoryUrl = req.params['category'];
    const countryUrl = req.params['country'];
    const filteredProjects = await projectsService.getFilteredProjects({ categoryUrl, countryUrl });
    
    // Get categories and countries
    const categories = await projectsService.getCategories();
    const countries = await projectsService.getCountries();
    
    // Get site settings
    const siteSettings = await siteSettingsService.getAllSettings();
    const siteTitle = siteSettings.siteTitle || 'CMS';
    
    // Get base SEO data for projects
    let seoData = pagesService.getSeoData('projects', {
      pageUrl: `${pagesService.getSiteData().domain}${req.path}`
    });
    
    // Custom SEO for category filter pages
    if (categoryUrl) {
      const category = categories.find(cat => 
        cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === categoryUrl
      );
      if (category) {
        seoData = pagesService.getSeoData('projects', {
          pageTitle: `${category} Steel Construction Projects - ${siteTitle}`,
          pageDescription: `Explore our ${category.toLowerCase()} steel construction projects. View our portfolio of ${category.toLowerCase()} projects including structural steel, architectural steelwork, and industrial facilities.`,
          pageKeywords: `${category.toLowerCase()}, steel construction, ${category.toLowerCase()} projects, structural steel, architectural steelwork, construction portfolio`,
          pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
          pageImage: '/images/projects.png',
          pageType: 'website'
        });
      }
    }
    
    // Custom SEO for country filter pages
    if (countryUrl) {
      const country = countries.find(c => 
        c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === countryUrl
      );
      if (country) {
        seoData = pagesService.getSeoData('projects', {
          pageTitle: `Steel Construction Projects in ${country} - ${siteTitle}`,
          pageDescription: `Explore our steel construction projects in ${country}. View our portfolio of commercial buildings, industrial facilities, and architectural steelwork projects in ${country}.`,
          pageKeywords: `${country}, steel construction, construction projects, ${country} projects, structural steel, architectural steelwork`,
          pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
          pageImage: '/images/projects.png',
          pageType: 'website'
        });
      }
    }
    
    // Add structured data for projects page
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": seoData.pageTitle,
      "description": seoData.pageDescription,
      "numberOfItems": filteredProjects.length,
      "itemListElement": filteredProjects.map((project: any, index: number) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "CreativeWork",
          "name": project.title,
          "description": project.description || `${project.title} steel construction project`,
          "url": `${pagesService.getSiteData().domain}/projects/${(project as any).url || project.slug}`,
          "image": `${pagesService.getSiteData().domain}${projectsService.getProjectImagePath(project)}`
        }
      }))
    };
    
    res.render('projects', {
      projects: { projects: filteredProjects },
      categories,
      countries,
      selectedCategory: categoryUrl,
      selectedCountry: countryUrl,
      bodyClass: (res.locals as any).bodyClass + ' dark-theme',
      ...seoData,
      structuredData: JSON.stringify(structuredData),
      projectsService: projectsService,
      siteData: pagesService.getSiteData(),
      siteSettings: siteSettings
    });
  } catch (error) {
    console.error('Error in showProjects:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function showProjectDetail(req: Request, res: Response): Promise<void> {
  try {
    const project = await projectsService.getProjectByUrl(req.params['projectUrl'] || '');
    
    // Get categories and countries
    const categories = await projectsService.getCategories();
    const countries = await projectsService.getCountries();
    
    // Get site settings
    const siteSettings = await siteSettingsService.getAllSettings();
    const siteTitle = siteSettings.siteTitle || 'CMS';
    
    if (!project) {
      const seoData = pagesService.getSeoData('home', {
        pageTitle: `Project Not Found - ${siteTitle}`,
        pageDescription: 'The requested steel construction project could not be found.',
        pageKeywords: 'project not found, 404',
        pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
        pageImage: pagesService.getSiteData().logo,
        pageType: 'website',
        pageRobots: 'noindex, nofollow'
      });
      
      return res.status(404).render('404', seoData);
    }
    
    // SEO data for individual project pages
    const seoData = pagesService.getSeoData('projects', {
      pageTitle: `${project.title} - Steel Construction Project | ${siteTitle}`,
      pageDescription: (project as any).description || `${project.title} steel construction project by ${siteTitle}. View details, specifications, and images of this project.`,
      pageKeywords: `${project.title}, steel construction, construction project, structural steel, architectural steelwork`,
      pageUrl: `${pagesService.getSiteData().domain}/projects/${(project as any).url || (project as any).slug}`,
      pageImage: projectsService.getProjectImagePath(project),
      pageType: 'article'
    });
    
    // Structured data for individual project
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "name": project.title,
      "description": seoData.pageDescription,
      "url": seoData.pageUrl,
      "image": `${pagesService.getSiteData().domain}${projectsService.getProjectImagePath(project)}`,
      "author": {
        "@type": "Organization",
        "name": pagesService.getSiteData().name
      },
      "publisher": {
        "@type": "Organization",
        "name": pagesService.getSiteData().name,
        "logo": {
          "@type": "ImageObject",
          "url": `${pagesService.getSiteData().domain}${pagesService.getSiteData().logo}`
        }
      },
      "datePublished": (project as any).year || "2024",
      "genre": "",
      "keywords": seoData.pageKeywords
    };
    
    res.render('project', {
      project,
      categories,
      countries,
      bodyClass: (res.locals as any).bodyClass + ' dark-theme',
      ...seoData,
      structuredData: JSON.stringify(structuredData),
      projectsService: projectsService,
      siteData: pagesService.getSiteData(),
      siteSettings: siteSettings
    });
  } catch (error) {
    console.error('Error in showProjectDetail:', error);
    res.status(500).send('Internal Server Error');
  }
}

export {
  showProjects,
  showProjectDetail
};
