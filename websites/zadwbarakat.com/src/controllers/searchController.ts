import type { Request, Response } from 'express';
import { searchTypes, SEARCH_TYPE_LABELS } from '../domain/search.js';
import { BadRequestError } from '../errors/httpError.js';
import { searchQuerySchema, suggestQuerySchema } from '../schemas/publicSchemas.js';
import { searchService } from '../services/searchService.js';

export class SearchController {
  public static async page(req: Request, res: Response): Promise<void> {
    const query = searchQuerySchema.parse(req.query);
    const result = await searchService.search({ q: query.q, type: query.type, sectionId: query.section, page: query.p });
    const seo = res.locals.seo as Record<string, string>;
    res.locals.seo = { ...seo, title: query.q ? `بحث: ${query.q}` : 'البحث' };
    res.locals.robots = 'noindex,follow';
    res.locals.searchQuery = query.q;
    res.render('search', {
      query,
      result,
      typeLabels: SEARCH_TYPE_LABELS,
      allTypes: searchTypes,
      breadcrumbs: [
        { title: 'الرئيسية', url: '/' },
        { title: 'البحث', url: '/search' }
      ],
      bodyClass: 'is-search'
    });
  }

  public static async suggest(req: Request, res: Response): Promise<void> {
    const parsed = suggestQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Enter between 1 and 80 characters.');
    }
    const suggestions = await searchService.suggest(parsed.data.q);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ query: parsed.data.q, suggestions });
  }
}
