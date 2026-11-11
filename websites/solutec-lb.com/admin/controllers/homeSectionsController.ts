import { Request, Response } from 'express';
import { HomeSectionsService, CATEGORIES_PLACEHOLDER, NEWS_PLACEHOLDER } from '../services/homeSectionsService';
import productsService from '../../src/services/productsService';

const homeSections = HomeSectionsService.getInstance();

export class HomeSectionsController {
  public static list(req: Request, res: Response): void {
    const data = homeSections.get();
    res.render('home/sections', {
      title: 'Home Page',
      pageTitle: 'Home Page',
      sections: data ? data.sections : [],
      missing: !data,
      success: req.query['success'],
      error: req.query['error']
    });
  }

  public static edit(req: Request, res: Response): void {
    const section = homeSections.getSection(String(req.params['key'] || ''));
    if (!section) {
      res.redirect('/admin/home?error=Section not found');
      return;
    }
    res.render('home/edit-section', {
      title: `Home Page: ${section.label}`,
      pageTitle: `Home Page: ${section.label}`,
      section,
      homeCategories: section.type === 'categories' ? productsService.getHomeCategories() : [],
      categoriesPlaceholder: CATEGORIES_PLACEHOLDER,
      newsPlaceholder: NEWS_PLACEHOLDER,
      includeCustomEditor: true,
      error: req.query['error']
    });
  }

  public static editPost(req: Request, res: Response): void {
    const key = String(req.params['key'] || '');
    const section = homeSections.getSection(key);
    if (!section) {
      res.redirect('/admin/home?error=Section not found');
      return;
    }
    const body = req.body || {};
    let html = typeof body.content === 'string' ? body.content : section.html;
    // Browsers submit textarea newlines as CRLF; keep the stored line endings unless they already used CR
    if (!section.html.includes('\r')) html = html.replace(/\r\n/g, '\n');

    if (section.type === 'categories' && !html.includes(CATEGORIES_PLACEHOLDER)) {
      res.redirect(`/admin/home/${encodeURIComponent(key)}/edit?error=${encodeURIComponent(`The HTML must keep the ${CATEGORIES_PLACEHOLDER} marker`)}`);
      return;
    }
    if (section.html.includes(NEWS_PLACEHOLDER) && !html.includes(NEWS_PLACEHOLDER)) {
      res.redirect(`/admin/home/${encodeURIComponent(key)}/edit?error=${encodeURIComponent(`The HTML must keep the ${NEWS_PLACEHOLDER} marker`)}`);
      return;
    }

    homeSections.updateSection(key, { html, enabled: body.enabled === '1' });
    res.redirect(`/admin/home?success=${encodeURIComponent(`${section.label} saved`)}`);
  }
}
