"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookProductFeedController = void 0;
const currentUrlProviderService_1 = require("../services/currentUrlProviderService");
const facebookProductFeedService_1 = require("../services/facebookProductFeedService");
class FacebookProductFeedController {
    static async productFeedXml(req, res) {
        try {
            const baseUrl = (0, currentUrlProviderService_1.getBaseUrl)(req).replace(/\/$/, '');
            const { xml, rowCount } = await (0, facebookProductFeedService_1.buildFacebookProductFeedWithStoreSettings)(baseUrl);
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('X-Feed-Row-Count', String(rowCount));
            res.send(xml);
        }
        catch (error) {
            console.error('Facebook product feed error:', error);
            res.status(500).send('Feed temporarily unavailable');
        }
    }
}
exports.FacebookProductFeedController = FacebookProductFeedController;
//# sourceMappingURL=facebookProductFeedController.js.map