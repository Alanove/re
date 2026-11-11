import { Request, Response, NextFunction } from 'express';
import pagesService from '../services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { ImageUtils } from '../utils/imageUtils';
import contactInfoService from '../services/contactInfoService';
import { careersService } from '../../admin/services/careersService';
import { NewsService, AdminNewsData } from '../../admin/services/newsService';
import { toNewsView } from '../utils/newsUtils';
import productsService from '../services/productsService';
import searchService from '../services/searchService';
import { TestimonialsService } from '../../admin/services/testimonialsService';
import { TeamService, COMPANY_KEYS } from '../../admin/services/teamService';

const siteSettingsService = SiteSettingsService.getInstance();
const newsService = NewsService.getInstance();
const testimonialsService = TestimonialsService.getInstance();
const teamService = TeamService.getInstance();

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
      (res.locals as any).pageTitle = pageData.title || 'Capital Pro Group';
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
        ? `Search results for "${query}" | Solutec`
        : 'Search | Capital Pro Group';
      (res.locals as any).pageDescription = query
        ? `Search results for ${query} on Solutec`
        : 'Search Solutec pages, news, and products';
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
    PagesController.renderNewsList(req, res, newsService.getPublishedNews(), 'News', '/news');
  }

  /**
   * Handle news category listing route (/category/:slug)
   */
  public static newsCategory(req: Request, res: Response): void {
    const slug = String(req.params['slug'] || '');
    const items = newsService.getPublishedNews().filter((item) => {
      const category = (item.category || '').trim();
      return category === slug || (slug === 'news' && !category);
    });
    const heading = slug === 'news' ? 'News' : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    PagesController.renderNewsList(req, res, items, heading, `/category/${slug}`);
  }

  private static renderNewsList(req: Request, res: Response, items: AdminNewsData[], heading: string, basePath: string): void {
    try {
      const perPage = 10;
      const totalPages = Math.max(1, Math.ceil(items.length / perPage));
      const page = Math.min(Math.max(parseInt(req.query.page as string) || 1, 1), totalPages);
      const news = items.slice((page - 1) * perPage, page * perPage).map(toNewsView);

      (res.locals as any).pageTitle = `${heading} – Solutec`;
      (res.locals as any).pageDescription = 'Latest news from Solutec.';
      (res.locals as any).selected = 'news-listing';
      (res.locals as any).introTitle = heading;
      (res.locals as any).introCrumbs = [{ label: heading }];
      res.render('news', {
        heading,
        news,
        basePath,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      });
    } catch (error) {
      console.error('Error loading news page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  private static renderNewsDetail(res: Response, newsItem: AdminNewsData): void {
    const all = newsService.getPublishedNews();
    const index = all.findIndex((item) => item.key === newsItem.key);
    const article = toNewsView(newsItem);
    (res.locals as any).pageTitle = newsItem.seo?.pageTitle || `${newsItem.title} – Solutec`;
    (res.locals as any).pageDescription = article.excerpt || newsItem.title;
    (res.locals as any).pageImage = article.image;
    (res.locals as any).selected = 'news';
    (res.locals as any).introTitle = newsItem.title;
    (res.locals as any).introCrumbs = [
      { href: '/category/news', label: 'News' },
      { label: newsItem.title }
    ];
    res.render('news-detail', {
      article,
      newerNews: index > 0 ? toNewsView(all[index - 1]) : null,
      olderNews: index >= 0 && index < all.length - 1 ? toNewsView(all[index + 1]) : null
    });
  }

  /**
   * Handle news detail page route
   */
  public static newsDetail(req: Request, res: Response, next: NextFunction): void {
    try {
      const newsItem = newsService.getNewsByKey(String(req.params.key));
      if (!newsItem || newsItem.status !== 'published') {
        return next();
      }
      PagesController.renderNewsDetail(res, newsItem);
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
      const contactPage = pagesService.getPageData('contact-us');
      (res.locals as any).bodyClass = (res.locals as any).bodyClass + ' dark-theme';
      (res.locals as any).currentPage = contactPage;
      (res.locals as any).pageImage = ImageUtils.getPageHeaderImageFromPage(contactPage);
      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: siteSettings,
        contactInfo: contactInfo,
        pageContent: contactPage?.content || ''
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
      const shopPaged = req.path.match(/^\/products\/page\/(\d+)\/?$/);
      const lookupPath = shopPaged ? '/products' : req.path;
      const pageData = pagesService.getPageByUrl(lookupPath);
      if (!pageData || (pageData as { status?: string }).status === 'draft') {
        const newsItem = newsService.getPublishedNews().find((item) => item.url === req.path);
        if (newsItem) {
          PagesController.renderNewsDetail(res, newsItem);
          return;
        }
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

      const kind = (pageData as { kind?: string }).kind || 'page';
      (res.locals as any).pageKind = kind;
      (res.locals as any).heading = pageData.title;
      (res.locals as any).isHome = false;

      if (kind === 'contact') {
        return PagesController.contact(req, res);
      }

      if (kind === 'products') {
        const perPage = 9;
        const all = productsService.getPublishedSorted();
        const shopPages = Math.max(1, Math.ceil(all.length / perPage));
        const requested = shopPaged ? parseInt(shopPaged[1], 10) : 1;
        const shopPage = Math.min(Math.max(requested || 1, 1), shopPages);
        (res.locals as any).catalogProducts = all.slice((shopPage - 1) * perPage, shopPage * perPage);
        (res.locals as any).categories = productsService.getCategoriesWithCounts();
        (res.locals as any).shopPage = shopPage;
        (res.locals as any).shopPages = shopPages;
        (res.locals as any).shopBase = '/products';
        (res.locals as any).activeCategory = '';
        (res.locals as any).bodyClass += ' woocommerce woocommerce-page woocommerce-shop';
      }

      if (kind === 'team') {
        const companyKey = COMPANY_KEYS[0].key;
        return PagesController.renderTeam(req, res, companyKey);
      }

      if (kind === 'testimonials') {
        testimonialsService.reload();
        (res.locals as any).testimonials = testimonialsService.getPublished();
        (res.locals as any).currentPage = pageData;
      } else {
        (res.locals as any).currentPage = pageData;
      }

      res.render('page');
    } catch (error) {
      console.error('Error loading dynamic page:', error);
      next();
    }
  }

  public static teamByCompany(req: Request, res: Response, next: NextFunction): void {
    const companyKey = String(req.params['company'] || '');
    const valid = COMPANY_KEYS.some((company) => company.key === companyKey);
    if (!valid) {
      return next();
    }
    PagesController.renderTeam(req, res, companyKey);
  }

  private static renderTeam(req: Request, res: Response, companyKey: string): void {
    const teamPage = pagesService.getPageData('our-team');
    const company = COMPANY_KEYS.find((item) => item.key === companyKey);
    teamService.reload();
    const members = teamService.getByCompany(companyKey).map((member) => {
      const assignment = member.companies.find((c) => c.key === companyKey);
      return {
        name: member.name,
        description: (assignment && assignment.description) || member.description || '',
        bio: member.bio || '',
        photo: member.photo || ''
      };
    });

    (res.locals as any).pageKind = 'team';
    (res.locals as any).heading = teamPage?.title || 'Our Team';
    (res.locals as any).pageTitle = `${company?.title || 'Our'} Team | Capital Pro Group`;
    (res.locals as any).pageImage = ImageUtils.getPageHeaderImageFromPage(teamPage);
    (res.locals as any).currentPage = teamPage;
    (res.locals as any).selected = 'our-team';
    (res.locals as any).teamCompanyKey = companyKey;
    (res.locals as any).teamHeading = `${company?.title || ''} Team`.trim();
    (res.locals as any).teamMembers = members;
    res.render('page');
  }
}
