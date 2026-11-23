"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const database_1 = require("../config/database");
class ReviewService {
    constructor() { }
    static getInstance() {
        if (!ReviewService.instance) {
            ReviewService.instance = new ReviewService();
        }
        return ReviewService.instance;
    }
    async submitReview(productId, data) {
        try {
            let isVerifiedPurchase = false;
            if (data.customer_id) {
                const [purchaseRows] = await database_1.db.query(`SELECT COUNT(*) as count 
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = ? AND o.customer_id = ? AND o.status = 'completed'`, [productId, data.customer_id]);
                isVerifiedPurchase = purchaseRows[0]?.count > 0;
            }
            const [result] = await database_1.db.query(`INSERT INTO product_reviews 
         (product_id, customer_id, reviewer_name, reviewer_email, rating, title, review_text, is_verified_purchase, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                productId,
                data.customer_id || null,
                data.reviewer_name,
                data.reviewer_email || null,
                data.rating,
                data.title || null,
                data.review_text,
                isVerifiedPurchase,
                false
            ]);
            const reviewId = result.insertId;
            await this.updateProductRating(productId);
            const review = await this.getReviewById(reviewId);
            if (!review) {
                throw new Error('Failed to retrieve created review');
            }
            return review;
        }
        catch (error) {
            console.error('Error submitting review:', error);
            throw error;
        }
    }
    async getAllReviews(filters = {}) {
        try {
            let query = `
        SELECT pr.*, p.name AS product_name
        FROM product_reviews pr
        LEFT JOIN products p ON pr.product_id = p.id
        WHERE 1=1
      `;
            const params = [];
            if (filters.product_id) {
                query += ' AND pr.product_id = ?';
                params.push(filters.product_id);
            }
            if (filters.customer_id) {
                query += ' AND pr.customer_id = ?';
                params.push(filters.customer_id);
            }
            if (filters.product_name && filters.product_name.trim()) {
                query += ' AND p.name LIKE ?';
                params.push('%' + filters.product_name.trim() + '%');
            }
            query += ' ORDER BY pr.created_at DESC';
            const [rows] = await database_1.db.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error getting all reviews:', error);
            throw error;
        }
    }
    async getProductReviews(productId, options = {}) {
        try {
            const { approvedOnly = true, limit, offset = 0 } = options;
            let query = `SELECT * FROM product_reviews WHERE product_id = ?`;
            const params = [productId];
            if (approvedOnly) {
                query += ' AND is_approved = TRUE';
            }
            query += ' ORDER BY created_at DESC';
            if (limit) {
                query += ' LIMIT ? OFFSET ?';
                params.push(limit, offset);
            }
            const [rows] = await database_1.db.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error getting product reviews:', error);
            throw error;
        }
    }
    async getReviewById(reviewId) {
        try {
            const [rows] = await database_1.db.query('SELECT * FROM product_reviews WHERE id = ?', [reviewId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error getting review:', error);
            throw error;
        }
    }
    async updateProductRating(productId) {
        try {
            const [ratingRows] = await database_1.db.query(`SELECT 
          AVG(rating) as average,
          COUNT(*) as count
         FROM product_reviews 
         WHERE product_id = ? AND is_approved = TRUE`, [productId]);
            const average = parseFloat(ratingRows[0]?.average || '0');
            const count = parseInt(ratingRows[0]?.count || '0');
            await database_1.db.query('UPDATE products SET rating_average = ?, rating_count = ? WHERE id = ?', [average, count, productId]);
        }
        catch (error) {
            console.error('Error updating product rating:', error);
        }
    }
    async approveReview(reviewId) {
        try {
            await database_1.db.query('UPDATE product_reviews SET is_approved = TRUE WHERE id = ?', [reviewId]);
            const review = await this.getReviewById(reviewId);
            if (review) {
                await this.updateProductRating(review.product_id);
            }
        }
        catch (error) {
            console.error('Error approving review:', error);
            throw error;
        }
    }
    async deleteReview(reviewId) {
        try {
            const review = await this.getReviewById(reviewId);
            if (!review) {
                throw new Error('Review not found');
            }
            await database_1.db.query('DELETE FROM product_reviews WHERE id = ?', [reviewId]);
            await this.updateProductRating(review.product_id);
        }
        catch (error) {
            console.error('Error deleting review:', error);
            throw error;
        }
    }
}
exports.ReviewService = ReviewService;
exports.default = ReviewService.getInstance();
//# sourceMappingURL=reviewService.js.map