import { db } from '../config/database';

export interface ProductReview {
  id: number;
  product_id: number;
  customer_id: number | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  title: string | null;
  review_text: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

export class ReviewService {
  private static instance: ReviewService;

  private constructor() {}

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  /**
   * Submit a product review
   */
  public async submitReview(
    productId: number,
    data: {
      customer_id?: number | null;
      reviewer_name: string;
      reviewer_email?: string;
      rating: number;
      title?: string;
      review_text: string;
    }
  ): Promise<ProductReview> {
    try {
      // Check if customer has purchased this product (for verified purchase)
      let isVerifiedPurchase = false;
      if (data.customer_id) {
        const [purchaseRows] = await db.query<any>(
          `SELECT COUNT(*) as count 
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = ? AND o.customer_id = ? AND o.status = 'completed'`,
          [productId, data.customer_id]
        );
        isVerifiedPurchase = purchaseRows[0]?.count > 0;
      }

      const [result] = await db.query<any>(
        `INSERT INTO product_reviews 
         (product_id, customer_id, reviewer_name, reviewer_email, rating, title, review_text, is_verified_purchase, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          data.customer_id || null,
          data.reviewer_name,
          data.reviewer_email || null,
          data.rating,
          data.title || null,
          data.review_text,
          isVerifiedPurchase,
          false // Reviews need admin approval by default
        ]
      );

      const reviewId = (result as any).insertId;
      
      // Update product rating average
      await this.updateProductRating(productId);

      const review = await this.getReviewById(reviewId);
      if (!review) {
        throw new Error('Failed to retrieve created review');
      }
      return review;
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  }

  /**
   * Get all reviews (admin) with optional filters. Joins product name.
   */
  public async getAllReviews(filters: { product_id?: number; customer_id?: number; product_name?: string } = {}): Promise<(ProductReview & { product_name?: string })[]> {
    try {
      let query = `
        SELECT pr.*, p.name AS product_name
        FROM product_reviews pr
        LEFT JOIN products p ON pr.product_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
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
      const [rows] = await db.query<any>(query, params);
      return rows as unknown as (ProductReview & { product_name?: string })[];
    } catch (error) {
      console.error('Error getting all reviews:', error);
      throw error;
    }
  }

  /**
   * Get reviews for a product
   */
  public async getProductReviews(
    productId: number,
    options: {
      approvedOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ProductReview[]> {
    try {
      const { approvedOnly = true, limit, offset = 0 } = options;
      
      let query = `SELECT * FROM product_reviews WHERE product_id = ?`;
      const params: any[] = [productId];

      if (approvedOnly) {
        query += ' AND is_approved = TRUE';
      }

      query += ' ORDER BY created_at DESC';

      if (limit) {
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const [rows] = await db.query<any>(query, params);
      return rows as unknown as ProductReview[];
    } catch (error) {
      console.error('Error getting product reviews:', error);
      throw error;
    }
  }

  /**
   * Get review by ID
   */
  public async getReviewById(reviewId: number): Promise<ProductReview | null> {
    try {
      const [rows] = await db.query<any>(
        'SELECT * FROM product_reviews WHERE id = ?',
        [reviewId]
      );
      return rows.length > 0 ? (rows[0] as unknown as ProductReview) : null;
    } catch (error) {
      console.error('Error getting review:', error);
      throw error;
    }
  }

  /**
   * Update product rating average
   */
  private async updateProductRating(productId: number): Promise<void> {
    try {
      const [ratingRows] = await db.query<any>(
        `SELECT 
          AVG(rating) as average,
          COUNT(*) as count
         FROM product_reviews 
         WHERE product_id = ? AND is_approved = TRUE`,
        [productId]
      );

      const average = parseFloat(ratingRows[0]?.average || '0');
      const count = parseInt(ratingRows[0]?.count || '0');

      await db.query(
        'UPDATE products SET rating_average = ?, rating_count = ? WHERE id = ?',
        [average, count, productId]
      );
    } catch (error) {
      console.error('Error updating product rating:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Approve review (admin)
   */
  public async approveReview(reviewId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE product_reviews SET is_approved = TRUE WHERE id = ?',
        [reviewId]
      );

      // Get product ID and update rating
      const review = await this.getReviewById(reviewId);
      if (review) {
        await this.updateProductRating(review.product_id);
      }
    } catch (error) {
      console.error('Error approving review:', error);
      throw error;
    }
  }

  /**
   * Delete review
   */
  public async deleteReview(reviewId: number): Promise<void> {
    try {
      const review = await this.getReviewById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      await db.query('DELETE FROM product_reviews WHERE id = ?', [reviewId]);
      
      // Update product rating
      await this.updateProductRating(review.product_id);
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  }
}

export default ReviewService.getInstance();
