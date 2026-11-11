import { Request, Response } from 'express';
import { SliderService } from '../../admin/services/sliderService';
import { PagesService } from '../../admin/services/pagesService';
import { NewsService } from '../../admin/services/newsService';
import { TestimonialsService } from '../../admin/services/testimonialsService';

const sliderService = SliderService.getInstance();
const pagesService = PagesService.getInstance();
const newsService = NewsService.getInstance();
const testimonialsService = TestimonialsService.getInstance();

export class HomeController {
  public static async index(req: Request, res: Response): Promise<void> {
    const searchQuery = typeof req.query.s === 'string' ? req.query.s.trim() : '';
    if (searchQuery) {
      res.redirect(302, `/search?s=${encodeURIComponent(searchQuery)}`);
      return;
    }

    try {
      sliderService.reloadData();
      testimonialsService.reload();
      pagesService.reloadPages();
      const slides = sliderService.getActiveSlides();
      const homePage = pagesService.getPageByKey('home');
      const pageContent = homePage?.content || '';
      const allNews = newsService.getPublishedNews();
      const latestNews = allNews.slice(0, 3);
      const testimonialsPage = pagesService.getPageByKey('testimonials');

      res.render('index', {
        slides,
        pageContent,
        latestNews,
        ourConcept: pagesService.getPageByKey('our-goals'),
        ourCompanies: pagesService.getPageByKey('our-companies'),
        whyChooseUs: pagesService.getPageByKey('why-choose-us'),
        testimonials: testimonialsService.getPublished(),
        testimonialsBanner: testimonialsPage?.pageImage || '/images/bg/testimonials.jpg',
        currentPage: homePage,
        isHome: true,
        pageType: 'website',
        bodyClass: 'home'
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
