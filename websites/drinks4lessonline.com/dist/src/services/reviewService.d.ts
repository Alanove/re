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
export declare class ReviewService {
    private static instance;
    private constructor();
    static getInstance(): ReviewService;
    submitReview(productId: number, data: {
        customer_id?: number | null;
        reviewer_name: string;
        reviewer_email?: string;
        rating: number;
        title?: string;
        review_text: string;
    }): Promise<ProductReview>;
    getAllReviews(filters?: {
        product_id?: number;
        customer_id?: number;
        product_name?: string;
    }): Promise<(ProductReview & {
        product_name?: string;
    })[]>;
    getProductReviews(productId: number, options?: {
        approvedOnly?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<ProductReview[]>;
    getReviewById(reviewId: number): Promise<ProductReview | null>;
    private updateProductRating;
    approveReview(reviewId: number): Promise<void>;
    deleteReview(reviewId: number): Promise<void>;
}
declare const _default: ReviewService;
export default _default;
//# sourceMappingURL=reviewService.d.ts.map