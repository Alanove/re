"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsController = void 0;
const reviewService_1 = __importDefault(require("../../src/services/reviewService"));
class ReviewsController {
    static async list(req, res) {
        try {
            const product_id = req.query.product_id ? parseInt(req.query.product_id, 10) : undefined;
            const customer_id = req.query.customer_id ? parseInt(req.query.customer_id, 10) : undefined;
            const product_name = req.query.product_name || undefined;
            const filters = {};
            if (product_id !== undefined)
                filters.product_id = product_id;
            if (customer_id !== undefined)
                filters.customer_id = customer_id;
            if (product_name !== undefined)
                filters.product_name = product_name;
            const reviews = await reviewService_1.default.getAllReviews(filters);
            const csrfToken = res.locals.csrfToken || '';
            const t = res.locals.t;
            res.render('reviews/reviews', {
                reviews,
                filters: { product_id, customer_id, product_name },
                csrfToken,
                title: t ? t('reviews.title') : 'Reviews'
            });
        }
        catch (error) {
            console.error('Reviews list error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
exports.ReviewsController = ReviewsController;
//# sourceMappingURL=reviewsController.js.map