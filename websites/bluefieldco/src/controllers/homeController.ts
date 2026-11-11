import { Request, Response } from 'express';
import { SliderService } from '../../admin/services/sliderService';
import { PagesService } from '../../admin/services/pagesService';
import { NewsService } from '../../admin/services/newsService';

const sliderService = SliderService.getInstance();
const pagesService = PagesService.getInstance();
const newsService = NewsService.getInstance();

export class HomeController {
  public static async index(req: Request, res: Response): Promise<void> {
    const searchQuery = typeof req.query.s === 'string' ? req.query.s.trim() : '';
    if (searchQuery) {
      res.redirect(302, `/search?s=${encodeURIComponent(searchQuery)}`);
      return;
    }

    try {
      sliderService.reloadData();
      const slides = sliderService.getActiveSlides();

      const homePage = pagesService.getPageByKey('home');
      const pageContent = homePage?.content || '';

      const allNews = newsService.getPublishedNews();
      const latestNews = allNews.slice(0, 3);

      res.render('index', {
        slides,
        pageContent,
        latestNews,
        pageType: 'website',
        bodyClass: 'home blog wp-custom-logo hfeed no-sidebar'
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
