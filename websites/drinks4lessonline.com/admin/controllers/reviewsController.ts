import { Request, Response } from 'express';
import reviewService from '../../src/services/reviewService';

export class ReviewsController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const product_id = req.query.product_id ? parseInt(req.query.product_id as string, 10) : undefined;
      const customer_id = req.query.customer_id ? parseInt(req.query.customer_id as string, 10) : undefined;
      const product_name = (req.query.product_name as string) || undefined;
      const filters: { product_id?: number; customer_id?: number; product_name?: string } = {};
      if (product_id !== undefined) filters.product_id = product_id;
      if (customer_id !== undefined) filters.customer_id = customer_id;
      if (product_name !== undefined) filters.product_name = product_name;
      const reviews = await reviewService.getAllReviews(filters);
      const csrfToken = (res.locals as any).csrfToken || '';
      const t = (res.locals as any).t;
      res.render('reviews/reviews', {
        reviews,
        filters: { product_id, customer_id, product_name },
        csrfToken,
        title: t ? t('reviews.title') : 'Reviews'
      });
    } catch (error) {
      console.error('Reviews list error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
