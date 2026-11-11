import { Request, Response } from 'express';
import { PagesService } from '../../admin/services/pagesService';

import { NewsService } from '../../admin/services/newsService';
import { HomeSectionsService } from '../../admin/services/homeSectionsService';
import { SliderService } from '../../admin/services/sliderService';
import productsService from '../services/productsService';

const pagesService = PagesService.getInstance();
const newsService = NewsService.getInstance();
const homeSectionsService = HomeSectionsService.getInstance();
const sliderService = SliderService.getInstance();

function getHeroSlides() {
  sliderService.reloadData();
  return sliderService.getActiveSlides()
    .filter((slide) => slide.image?.trim())
    .map((slide) => ({ ...slide, image: sliderService.getImageUrl(slide.image) }));
}

export class HomeController {
  public static async index(req: Request, res: Response): Promise<void> {
    const searchQuery = typeof req.query.s === 'string' ? req.query.s.trim() : '';
    if (searchQuery) {
      res.redirect(302, `/search?s=${encodeURIComponent(searchQuery)}`);
      return;
    }

    try {
      pagesService.reloadPages();
      const homePage = pagesService.getPageByKey('home');
      (res.locals as any).currentPage = homePage;
      (res.locals as any).pageTitle = homePage?.seo?.pageTitle || homePage?.title || 'Solutec';
      (res.locals as any).pageDescription = homePage?.seo?.pageDescription || '';
      res.render('index', {
        pageContent: homePage?.content || '',
        homeSections: homeSectionsService.get(),
        heroSlides: getHeroSlides(),
        homeCategories: productsService.getHomeCategories(),
        latestNews: newsService.getPublishedNews().slice(0, 8),
        currentPage: homePage,
        isHome: true
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
