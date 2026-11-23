import { Request, Response } from 'express';
import { getBaseUrl } from '../services/currentUrlProviderService';
import { buildFacebookProductFeedWithStoreSettings } from '../services/facebookProductFeedService';

export class FacebookProductFeedController {
  /**
   * Public RSS/XML product feed for Meta Commerce Manager (scheduled data feed URL).
   * Spec: https://www.facebook.com/business/help/120325381656392
   */
  static async productFeedXml(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = getBaseUrl(req).replace(/\/$/, '');
      const { xml, rowCount } = await buildFacebookProductFeedWithStoreSettings(baseUrl);

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Feed-Row-Count', String(rowCount));
      res.send(xml);
    } catch (error) {
      console.error('Facebook product feed error:', error);
      res.status(500).send('Feed temporarily unavailable');
    }
  }
}
