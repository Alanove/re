import { Request, Response, NextFunction } from 'express';
import pagesService from '../services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { ImageUtils } from '../utils/imageUtils';
import contactInfoService from '../services/contactInfoService';
import { careersService } from '../../admin/services/careersService';
import { NewsService } from '../../admin/services/newsService';
import searchService from '../services/searchService';

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
      const aboutImages = ImageUtils.getPageHeaderSources(pageData as { pageImage?: string; image?: string });
      (res.locals as any).pageImage = ImageUtils.getPageHeaderImage(aboutImages);
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
      const possibleImages = ImageUtils.getPageHeaderSources(careersPageData);
      const pageImage = ImageUtils.getPageHeaderImage(possibleImages);
      
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
   * Site search results (WordPress-style ?s= query param)
   */
  public static search(req: Request, res: Response): void {
    try {
      const raw = (req.query.s as string) || '';
      const query = raw.trim();
      const results = query ? searchService.search(query) : [];

      (res.locals as any).pageTitle = query
        ? `Search results for "${query}" | BlueField Group`
        : 'Search | BlueField Group';
      (res.locals as any).pageDescription = query
        ? `Search results for ${query} on BlueField Group`
        : 'Search BlueField Group pages and news';
      (res.locals as any).selected = 'search';
      (res.locals as any).pageRobots = 'noindex, follow';

      res.render('search', { query, results });
    } catch (error) {
      console.error('Error loading search page:', error);
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
      const allNews = newsService.getPublishedNews().slice().sort((a, b) => {
        const sortA = (a as { listingSort?: number }).listingSort ?? 999;
        const sortB = (b as { listingSort?: number }).listingSort ?? 999;
        if (sortA !== sortB) return sortA - sortB;
        return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
      });

      const totalNews = allNews.length;
      const totalPages = Math.ceil(totalNews / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const news = allNews.slice(startIndex, endIndex);

      (res.locals as any).pageTitle = 'News and Events | BlueField Group';
      (res.locals as any).pageDescription =
        'Discover BlueField Group\'s latest news and events, including field days, trial stations, and new product\'s introduction';
      (res.locals as any).selected = 'news-listing';
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
   * Resolve CMS page by full request path (supports nested URLs)
   */
  public static dynamicPageByPath(req: Request, res: Response, next: NextFunction): void {
    try {
      const pageData = pagesService.getPageByUrl(req.path);
      if (!pageData || (pageData as { status?: string }).status === 'draft') {
        return next();
      }

      (res.locals as any).pageContent = pageData.content || '';
      (res.locals as any).selected = pageData.key;
      (res.locals as any).pageTitle = pageData.title || pageData.key;

      (res.locals as any).pageImage = ImageUtils.getPageHeaderImageFromPage(pageData);
      (res.locals as any).childPages = [];
      (res.locals as any).isParentPage = false;

      if (pageData.seo) {
        (res.locals as any).pageTitle = pageData.seo.pageTitle || pageData.title;
        (res.locals as any).pageDescription = pageData.seo.pageDescription || '';
      }

      res.render('page');
    } catch (error) {
      console.error('Error loading dynamic page:', error);
      next();
    }
  }
}
