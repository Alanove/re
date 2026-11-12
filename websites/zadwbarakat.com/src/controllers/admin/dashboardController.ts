import type { Request, Response } from 'express';
import { dashboardService } from '../../services/dashboardService.js';
import { render } from './helpers.js';

export class DashboardController {
  public static async show(_req: Request, res: Response): Promise<void> {
    const summary = await dashboardService.summary();
    render(res, 'dashboard/index', { pageTitle: 'Dashboard', summary });
  }

  public static async data(_req: Request, res: Response): Promise<void> {
    const summary = await dashboardService.summary();
    res.json({
      success: true,
      statistics: { totalArticles: summary.articles.total, publishedArticles: summary.articles.published, draftArticles: summary.articles.drafts, pages: summary.pages }
    });
  }
}
