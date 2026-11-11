import { Request, Response } from 'express';
import { SliderService } from '../../admin/services/sliderService';
import { ClientsService } from '../../admin/services/clientsService';
import { HeroService } from '../../admin/services/heroService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { PagesService } from '../../admin/services/pagesService';
import projectsService from '../services/projectsService';
import { getMenuItems } from '../services/menuService';

const sliderService = SliderService.getInstance();
const heroService = HeroService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const pagesService = PagesService.getInstance();

export class HomeController {
  /**
   * Render home page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      sliderService.reloadData(); // Reload data to get latest changes
      const slides = sliderService.getActiveSlides();
      
      // Get countries with projects for the world map
      const countriesWithProjects = projectsService.getCountries();
      
      // Get projects organized by country for tooltips
      const allProjects = projectsService.getProjects();
      const projectsByCountry: { [country: string]: string[] } = {};
      
      allProjects.projects.forEach(project => {
        if (project.country) {
          if (!projectsByCountry[project.country]) {
            projectsByCountry[project.country] = [];
          }
          projectsByCountry[project.country].push(project.title);
        }
      });

      // Calculate project statistics
      const calculatedTotalProjects = allProjects.projects.length;
      const uniqueCountries = [...new Set(allProjects.projects.map(p => p.country).filter(c => c))];
      const calculatedTotalCountries = uniqueCountries.length;
      const uniqueCategories = [...new Set(allProjects.projects.flatMap(p => p.categories || []))];
      const totalCategories = uniqueCategories.length;
      
      // Load clients for home page clients section
      const clientsService = ClientsService.getInstance();
      const clients = clientsService.getAllClients();
      const calculatedClientsCount = clients.length;
      
      // Load hero section data
      const heroData = heroService.getHeroSectionData();
      const activeQuotes = heroService.getActiveQuotes();
      const currentVideoBackgroundType = heroService.getCurrentVideoBackgroundType();
      
      // Load menu items for horizontal menu
      const menuItems = getMenuItems();
      
      // Load site settings and home page content
      const siteData = siteSettingsService.getAllSettings();
      const homePage = pagesService.getPageByKey('home');
      const pageContent = homePage ? homePage.content : '';
      
      // Load about page data for the about section
      const aboutPage = pagesService.getPageByKey('about');
      const aboutTitle = aboutPage ? aboutPage.title : 'About EMDC Group';
      const aboutContent = aboutPage ? aboutPage.content : '';
      const aboutImage = aboutPage ? (aboutPage as any).pageImage : '';
      
      // Get success indicators from settings with fallback to calculated values
      const successIndicators = (siteData as any).successIndicators || {};
      const totalProjects = successIndicators.totalProjects && successIndicators.totalProjects !== '' 
        ? parseInt(successIndicators.totalProjects, 10) 
        : calculatedTotalProjects;
      const totalCountries = successIndicators.totalCountries && successIndicators.totalCountries !== '' 
        ? parseInt(successIndicators.totalCountries, 10) 
        : calculatedTotalCountries;
      const specialists = successIndicators.specialists || '48';
      const specialistsSublabel = successIndicators.specialistsSublabel || 'Beirut - Cairo - Riyadh';
      const clientsCount = successIndicators.totalClients && successIndicators.totalClients !== '' 
        ? parseInt(successIndicators.totalClients, 10) 
        : calculatedClientsCount;
      
      // Get "+" icon flags
      const showPlusIcon = {
        totalProjects: successIndicators.totalProjectsShowPlus || false,
        totalCountries: successIndicators.totalCountriesShowPlus || false,
        specialists: successIndicators.specialistsShowPlus || false,
        totalClients: successIndicators.totalClientsShowPlus || false
      };
      
      res.render('index', { 
        slides,
        countriesWithProjects,
        projectsByCountry,
        projectStats: {
          totalProjects,
          totalCountries,
          totalCategories
        },
        clients,
        clientsCount,
        specialists,
        specialistsSublabel,
        showPlusIcon,
        heroData,
        activeQuotes,
        currentVideoBackgroundType,
        menuItems,
        siteData,
        pageContent,
        aboutTitle,
        aboutContent,
        aboutImage,
        pageType: 'home',
        bodyClass: `home-page light-background`
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
