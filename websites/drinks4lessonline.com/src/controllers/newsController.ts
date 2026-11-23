import { Request, Response } from 'express';
import { PagesService as AdminPagesService } from '../../admin/services/pagesService';
import { db } from '../config/database';

const adminPagesService = AdminPagesService.getInstance();

export class NewsController {
  /**
   * Render news listing page with pagination
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12; // 12 articles per page
      
      // Get pages with news tag and pagination
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'news' // Filter by news tag slug
      });
      
      const totalPages = Math.ceil(result.total / itemsPerPage);
      
      // Set selected state for menu highlighting
      (res.locals as any).selected = 'novosti';
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news listing:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render individual news article
   */
  public static async article(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;
      
      // Get article by slug
      const article = await adminPagesService.getPageBySlug(slug);
      
      if (!article || article.status !== 'published') {
        return res.status(404).render('404');
      }
      
      // Check if article has news tag
      const hasNewsTag = article.tags && article.tags.some((tag: any) => tag.slug === 'news');
      
      if (!hasNewsTag) {
        // If it doesn't have news tag, render as regular page
        return res.status(404).render('404');
      }
      
      // Get related articles (other news articles)
      const relatedResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 4,
        status: 'published',
        tag: 'news'
      });
      
      // Filter out current article from related and take 3
      const relatedArticles = relatedResult.pages.filter((a: any) => a.id !== article.id).slice(0, 3);
      
      // Load gallery photos for this article
      const pagePhotos = await adminPagesService.getPagePhotos(article.id);
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      // Set selected state for menu highlighting (use article slug)
      (res.locals as any).selected = `novosti-${article.slug}`;
      (res.locals as any).pageTitle = article.title;
      (res.locals as any).pageImage = article.pageImage || '';
      (res.locals as any).pageDescription = article.metaDescription || article.description || '';
      
      res.render('news/article', {
        article: article,
        relatedArticles: relatedArticles,
        pagePhotos: pagePhotos || [],
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news article:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render news filtered by year
   */
  public static async listByYear(req: Request, res: Response): Promise<void> {
    try {
      const year = parseInt(req.params.year);
      if (isNaN(year)) {
        return res.status(404).render('404');
      }

      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;
      
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'news',
        year: year
      });
      
      const totalPages = Math.ceil(result.total / itemsPerPage);
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      (res.locals as any).selected = 'novosti';
      
      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filterType: 'year',
        filterValue: year,
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news by year:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render news filtered by month
   */
  public static async listByMonth(req: Request, res: Response): Promise<void> {
    try {
      const dateParts = req.params.date.split('-');
      if (dateParts.length !== 2) {
        return res.status(404).render('404');
      }

      const month = parseInt(dateParts[0]);
      const year = parseInt(dateParts[1]);
      
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return res.status(404).render('404');
      }

      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;
      
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'news',
        year: year,
        month: month
      });
      
      const totalPages = Math.ceil(result.total / itemsPerPage);
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      (res.locals as any).selected = 'novosti';
      
      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filterType: 'month',
        filterValue: { month, year },
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news by month:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render news filtered by day
   */
  public static async listByDay(req: Request, res: Response): Promise<void> {
    try {
      const dateParts = req.params.date.split('-');
      if (dateParts.length !== 3) {
        return res.status(404).render('404');
      }

      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const year = parseInt(dateParts[2]);
      
      if (isNaN(day) || isNaN(month) || isNaN(year) || 
          day < 1 || day > 31 || month < 1 || month > 12) {
        return res.status(404).render('404');
      }

      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;
      
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'news',
        year: year,
        month: month,
        day: day
      });
      
      const totalPages = Math.ceil(result.total / itemsPerPage);
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      (res.locals as any).selected = 'novosti';
      
      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filterType: 'day',
        filterValue: { day, month, year },
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news by day:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render news filtered by tag
   */
  public static async listByTag(req: Request, res: Response): Promise<void> {
    try {
      const tagSlug = req.params.tagSlug;
      if (!tagSlug) {
        return res.status(404).render('404');
      }

      // Get tag name from database
      const [tagRows] = await db.query(
        'SELECT name, slug FROM page_tags WHERE slug = ?',
        [tagSlug]
      );
      const tags = tagRows as Array<{ name: string; slug: string }>;
      if (!tags || tags.length === 0) {
        return res.status(404).render('404');
      }
      const tagName = tags[0].name;

      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 12;
      
      // Get all pages with the specified tag (from all categories)
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: tagSlug
      });
      
      // Get archive data for sidebar
      const newsDates = await adminPagesService.getNewsDates();
      const archiveDates = await adminPagesService.getNewsArchiveDates();
      
      (res.locals as any).selected = 'novosti';
      
      const totalPages = Math.ceil(result.total / itemsPerPage);
      
      res.render('news/list', {
        articles: result.pages,
        currentPage: page,
        totalPages: totalPages,
        totalArticles: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filterType: 'tag',
        filterValue: tagSlug,
        tagName: tagName,
        newsDates: newsDates,
        archiveDates: archiveDates
      });
    } catch (error) {
      console.error('Error rendering news by tag:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
