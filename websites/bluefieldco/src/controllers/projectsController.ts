import { Request, Response } from 'express';
import projectsService from '../services/projectsService';
import pagesService from '../services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { Project } from '../types';

const siteSettingsService = SiteSettingsService.getInstance();

function showProjects(req: Request, res: Response): void {
  const categoryUrl = req.params['category'];
  const countryUrl = req.params['country'];
  const regionUrl = req.params['region'];
  const filteredProjects = projectsService.getFilteredProjects({ categoryUrl, countryUrl, regionUrl });
  
  // Get categories, countries, and regions with error handling
  let categories: string[] = [];
  let countries: string[] = [];
  let regions: string[] = [];
  
  try {
    categories = projectsService.getCategories();
  } catch (error) {
    console.error('Error getting categories:', error);
    categories = [];
  }
  
  try {
    countries = projectsService.getCountries();
  } catch (error) {
    console.error('Error getting countries:', error);
    countries = [];
  }
  
  try {
    regions = projectsService.getRegions();
  } catch (error) {
    console.error('Error getting regions:', error);
    regions = [];
  }
  
  // Get site title from settings
  const siteTitle = siteSettingsService.getSiteTitle() || 'CMS';
  
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
        pageTitle: `${category} Projects - ${siteTitle}`,
        pageDescription: `Explore our ${category.toLowerCase()} projects. View our portfolio of ${category.toLowerCase()} projects including structural steel, architectural steelwork, and industrial facilities.`,
        pageKeywords: `${category.toLowerCase()}, ${category.toLowerCase()} projects, structural steel, architectural steelwork, construction portfolio`,
        pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
        pageImage: '/images/projects.png',
        pageType: 'website'
      });
    }
  }
  
  // Custom SEO for region filter pages
  if (regionUrl) {
    const region = regions.find(r => 
      r.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === regionUrl
    );
    if (region) {
      seoData = pagesService.getSeoData('projects', {
        pageTitle: `Projects in ${region} - ${siteTitle}`,
        pageDescription: `Explore our projects in ${region}. View our portfolio of commercial buildings, industrial facilities, and architectural steelwork projects.`,
        pageKeywords: `${region}, projects, construction projects, structural steel, architectural steelwork`,
        pageUrl: `${pagesService.getSiteData().domain}${req.path}`,
        pageImage: '/images/projects.png',
        pageType: 'website'
      });
    }
  }
  
  // Custom SEO for country filter pages (legacy support)
  if (countryUrl && !regionUrl) {
    const country = countries.find(c => 
      c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === countryUrl
    );
    if (country) {
      seoData = pagesService.getSeoData('projects', {
        pageTitle: `Projects in ${country} - ${siteTitle}`,
        pageDescription: `Explore our projects in ${country}. View our portfolio of commercial buildings, industrial facilities, and architectural steelwork projects in ${country}.`,
        pageKeywords: `${country}, projects, construction projects, ${country} projects, structural steel, architectural steelwork`,
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
    "itemListElement": filteredProjects.map((project: Project, index: number) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "CreativeWork",
        "name": project.title,
        "description": (project as any).description || `${project.title} project`,
        "url": `${pagesService.getSiteData().domain}/projects/${project.url}`,
        "image": `${pagesService.getSiteData().domain}${projectsService.getProjectImagePath(project)}`
      }
    }))
  };
  
  res.render('projects', {
    projects: { projects: filteredProjects },
    categories,
    countries,
    regions,
    selectedCategory: categoryUrl,
    selectedCountry: countryUrl,
    selectedRegion: regionUrl,
    bodyClass: (res.locals as any).bodyClass + ' projects-page',
    ...seoData,
    structuredData: JSON.stringify(structuredData),
    projectsService: projectsService,
    siteData: pagesService.getSiteData(),
    siteSettings: siteSettingsService.getAllSettings()
  });
}

function showProjectDetail(req: Request, res: Response): void {
  const project = projectsService.getProjectByUrl(req.params['projectUrl'] || '');
  
  // Get categories and countries with error handling
  let categories: string[] = [];
  let countries: string[] = [];
  
  try {
    categories = projectsService.getCategories();
  } catch (error) {
    console.error('Error getting categories:', error);
    categories = [];
  }
  
  try {
    countries = projectsService.getCountries();
  } catch (error) {
    console.error('Error getting countries:', error);
    countries = [];
  }
  
  // Get site title from settings
  const siteTitle = siteSettingsService.getSiteTitle() || 'CMS';
  
  if (!project) {
      const seoData = pagesService.getSeoData('home', {
      pageTitle: `Project Not Found - ${siteTitle}`,
      pageDescription: 'The requested project could not be found.',
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
    pageTitle: `${project.title} - Project | ${siteTitle}`,
    pageDescription: (project as any).description || `${project.title} project by ${siteTitle}. View details, specifications, and images of this ${project.categories.join(', ').toLowerCase()} project.`,
    pageKeywords: `${project.title}, ${project.categories.join(', ')}, construction project, structural steel, architectural steelwork`,
    pageUrl: `${pagesService.getSiteData().domain}/projects/${project.url}`,
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
    "genre": project.categories.join(', '),
    "keywords": seoData.pageKeywords
  };
  
  res.render('project', {
    project,
    categories,
    countries,
    bodyClass: (res.locals as any).bodyClass + ' projects-page',
    ...seoData,
    structuredData: JSON.stringify(structuredData),
    projectsService: projectsService,
    siteData: pagesService.getSiteData(),
    siteSettings: siteSettingsService.getAllSettings()
  });
}

function getProjectApiData(req: Request, res: Response): void {
  const projectUrl = req.params['projectUrl'];
  const project = projectsService.getProjectByUrl(projectUrl || '');
  
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Transform project data for API response
  const apiProject = {
    title: project.title,
    categories: project.categories,
    image: projectsService.getProjectImagePath(project),
    country: project.country,
    bau: project.bau,
    area: project.area,
    size: project.size,
    quantity: project.quantity,
    contractor: project.contractor,
    architect: project.architect,
    client: project.client,
    scope: project.scope,
    works: project.works?.map(work => ({
      details: work.details,
      scope_of_work: work.scope_of_work,
      images: work.images?.map(img => ({
        url: projectsService.getWorkImagePath(project, work, img)
      }))
    }))
  };

  res.json(apiProject);
}

export {
  showProjects,
  showProjectDetail,
  getProjectApiData
}; 