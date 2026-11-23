import { Request, Response } from 'express';
export declare class ShopController {
    private static metaCurrency;
    private static ensureOrderBelongsToUser;
    static index(req: Request, res: Response): Promise<void>;
    private static calculateAvailableFilters;
    static detail(req: Request, res: Response): Promise<void>;
    static cart(req: Request, res: Response): Promise<void>;
    static addToCart(req: Request, res: Response): Promise<void>;
    static updateCartItem(req: Request, res: Response): Promise<void>;
    static removeCartItem(req: Request, res: Response): Promise<void>;
    private static populateCartFromMetaShopCheckout;
    static checkout(req: Request, res: Response): Promise<void>;
    static getShippingRates(req: Request, res: Response): Promise<void>;
    static getShippingCities(req: Request, res: Response): Promise<void>;
    static getShippingStates(req: Request, res: Response): Promise<void>;
    static getCheckoutPaymentMethods(req: Request, res: Response): Promise<void>;
    private static cancelOrderAndRestoreToCart;
    static checkoutPay(req: Request, res: Response): Promise<void>;
    static checkoutComplete(req: Request, res: Response): Promise<void>;
    static checkoutCancel(req: Request, res: Response): Promise<void>;
    static orderSuccess(req: Request, res: Response): Promise<void>;
    static orderError(req: Request, res: Response): Promise<void>;
    static processCheckout(req: Request, res: Response): Promise<void>;
    static validateDiscount(req: Request, res: Response): Promise<void>;
    static submitReview(req: Request, res: Response): Promise<void>;
    static getReviews(req: Request, res: Response): Promise<void>;
    static getProductDetails(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=shopController.d.ts.map