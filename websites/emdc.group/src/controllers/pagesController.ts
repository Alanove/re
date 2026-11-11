import { Request, Response, NextFunction } from 'express';
import pagesService from '../services/pagesService';
import { getChildMenuItems } from '../services/menuService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { ImageUtils } from '../utils/imageUtils';
import contactInfoService from '../services/contactInfoService';
import { careersService } from '../../admin/services/careersService';
import { NewsService } from '../../admin/services/newsService';

const siteSettingsService = SiteSettingsService.getInstance();
const newsService = NewsService.getInstance();

export class PagesController {
  /**
   * Handle about page route
   */
  public static about(req: Request, res: Response): void {
    const pageData = pagesService.getPageData('about');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).pageImage = (pageData as any).pageImage || '';
      (res.locals as any).pageTitle = pageData.title || 'About EMDC Group';
    }
    res.render('about');
  }

  /**
   * Handle services page route
   */
  public static services(req: Request, res: Response): void {
    const pageData = pagesService.getPageData('services');
    if (pageData) {
      (res.locals as any).pageContent = pageData.content || '';
      // backgroundImage removed - using only pageImage
    }
    res.render('services');
  }

  /**
   * Handle careers page route
   */
  public static careers(req: Request, res: Response): void {
    try {
      const careers = careersService.getPublishedCareers();
      // Get intro text and image from the careers page in pages.json
      const careersPageData = pagesService.getPageData('careers');
      const introText = careersPageData?.content || '';
      
      // Get page image with validation
      const possibleImages = [
        (careersPageData as any)?.pageImage,
        (careersPageData as any)?.image
      ].filter(img => img && img.trim() !== '');
      
      const pageImage = ImageUtils.getBestImage(possibleImages);
      
      // Get contact email and careers email from site settings
      const contactEmail = siteSettingsService.getContactEmail();
      const careersEmail = siteSettingsService.getCareersEmail();
      
      (res.locals as any).pageTitle = careersPageData?.title || 'Careers';
      (res.locals as any).selected = 'careers';
      
      res.render('careers', {
        careers: careers,
        introText: introText,
        pageImage: pageImage,
        contactEmail: contactEmail,
        careersEmail: careersEmail
      });
    } catch (error) {
      console.error('Error loading careers page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle news listing page route
   */
  public static news(req: Request, res: Response): void {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = 10;
      const allNews = newsService.getPublishedNews();
      
      // Calculate pagination
      const totalNews = allNews.length;
      const totalPages = Math.ceil(totalNews / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const news = allNews.slice(startIndex, endIndex);
      
      (res.locals as any).pageTitle = 'News';
      (res.locals as any).selected = 'news';
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme contact news-page';
      
      res.render('news', {
        news: news,
        currentPage: page,
        totalPages: totalPages,
        totalNews: totalNews,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      });
    } catch (error) {
      console.error('Error loading news page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle news detail page route
   */
  public static newsDetail(req: Request, res: Response, next: NextFunction): void {
    try {
      const newsKey = req.params.key;
      const newsItem = newsService.getNewsByKey(newsKey);
      
      if (!newsItem || newsItem.status !== 'published') {
        return next(); // 404
      }
      
      (res.locals as any).pageTitle = newsItem.title;
      (res.locals as any).selected = 'news';
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme contact news-page';
      
      res.render('news-detail', {
        newsItem: newsItem
      });
    } catch (error) {
      console.error('Error loading news detail page:', error);
      next();
    }
  }

  /**
   * Handle contact page route
   */
  public static contact(req: Request, res: Response): void {
    try {
      const siteSettings = siteSettingsService.getAllSettings();
      const contactInfo = contactInfoService.getAllContactInfo();
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettings,
        contactInfo: contactInfo
      });
    } catch (error) {
      console.error('Error loading contact page:', error);
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettingsService.getAllSettings(),
        contactInfo: contactInfoService.getAllContactInfo()
      });
    }
  }

  /**
   * Handle dynamic page route for pages defined in admin menu system
   */
  public static dynamicPage(req: Request, res: Response, next: NextFunction): void {
    const pageSlug = req.params.pageSlug;
    
    // Skip admin routes and static files
    if (pageSlug.startsWith('admin') || pageSlug.includes('.')) {
      return next();
    }
    
    try {
      const pageData = pagesService.getPageData(pageSlug);
      if (pageData) {
        // Check if this page has child menu items
        const childMenuItems = getChildMenuItems(pageSlug);
        
        if (childMenuItems.length > 0) {
          // This is a parent page with children - render with sections
          const childPages = childMenuItems.map(childItem => {
            const childPageData = pagesService.getPageData(childItem.key);
            return {
              menuItem: childItem,
              pageData: childPageData
            };
          }).filter(item => item.pageData); // Only include pages that exist
          
          (res.locals as any).pageContent = pageData.content || '';
          (res.locals as any).selected = pageData.key || pageSlug;
          (res.locals as any).pageTitle = pageData.title || pageData.key || pageSlug;
          
          // Ensure pageImage is set with validation
          const possibleImages = [
            (pageData as any).pageImage,
            (pageData as any).image
          ].filter(img => img && img.trim() !== '');
          
          (res.locals as any).pageImage = ImageUtils.getBestImage(possibleImages);
          (res.locals as any).childPages = childPages;
          (res.locals as any).isParentPage = true;
          
          // Add latest 3 news items for insights page
          if (pageSlug === 'insights') {
            const allNews = newsService.getPublishedNews();
            (res.locals as any).latestNews = allNews.slice(0, 3);
          }
          
          res.render('page'); // Will use the updated template with sections
        } else {
          // Regular single page
          (res.locals as any).pageContent = pageData.content || '';
          (res.locals as any).selected = pageData.key || pageSlug;
          (res.locals as any).pageTitle = pageData.title || pageData.key || pageSlug;
          // Ensure pageImage is set with validation
          const possibleImages = [
            (pageData as any).pageImage,
            (pageData as any).image
          ].filter(img => img && img.trim() !== '');
          
          (res.locals as any).pageImage = ImageUtils.getBestImage(possibleImages);
          (res.locals as any).childPages = [];
          (res.locals as any).isParentPage = false;
          
          // Log image information for debugging
          const imageInfo = ImageUtils.getImageInfo((res.locals as any).pageImage);
          console.log(`Page ${pageSlug} - pageImage: ${(res.locals as any).pageImage}, exists: ${imageInfo.exists}, possible sources: ${possibleImages.join(', ')}`);
          console.log(`Page ${pageSlug} - Full pageData:`, JSON.stringify(pageData, null, 2));
          
          res.render('page');
        }
      } else {
        // Check if it's a custom page that needs special handling
        if (pageSlug === 'who-we-are') {
          return res.render('about');
        } else if (pageSlug === 'contact-us') {
          return res.redirect('/contact');
        } else if (pageSlug.startsWith('what-we-do') || pageSlug.startsWith('Our-') || pageSlug === 'our-it-system') {
          // For now, render a generic page template
          (res.locals as any).pageContent = `<h1>${pageSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h1><p>This page is coming soon.</p>`;
          (res.locals as any).pageImage = '';
          (res.locals as any).childPages = [];
          (res.locals as any).isParentPage = false;
          return res.render('page');
        }
        next(); // Continue to 404 handler
      }
    } catch (error) {
      console.error('Error loading dynamic page:', error);
      next();
    }
  }
}
