import { Request, Response } from 'express';
export declare class CustomerController {
    static account(req: Request, res: Response): Promise<void>;
    static ordersPage(req: Request, res: Response): Promise<void>;
    static orderDetailPage(req: Request, res: Response): Promise<void>;
    static addressesPage(req: Request, res: Response): Promise<void>;
    static wishlistPage(req: Request, res: Response): Promise<void>;
    static loginPage(req: Request, res: Response): Promise<void>;
    static registerPage(req: Request, res: Response): Promise<void>;
    static register(req: Request, res: Response): Promise<void>;
    static forgotPasswordPage(req: Request, res: Response): Promise<void>;
    static forgotPassword(req: Request, res: Response): Promise<void>;
    static resetPasswordPage(req: Request, res: Response): Promise<void>;
    static resetPassword(req: Request, res: Response): Promise<void>;
    static login(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static logoutRedirect(req: Request, res: Response): Promise<void>;
    static getProfile(req: Request, res: Response): Promise<void>;
    static updateProfile(req: Request, res: Response): Promise<void>;
    static getOrders(req: Request, res: Response): Promise<void>;
    static getOrder(req: Request, res: Response): Promise<void>;
    static trackOrder(req: Request, res: Response): Promise<void>;
    static getAddresses(req: Request, res: Response): Promise<void>;
    static addAddress(req: Request, res: Response): Promise<void>;
    static updateAddress(req: Request, res: Response): Promise<void>;
    static deleteAddress(req: Request, res: Response): Promise<void>;
    static getWishlist(req: Request, res: Response): Promise<void>;
    static addToWishlist(req: Request, res: Response): Promise<void>;
    static removeFromWishlist(req: Request, res: Response): Promise<void>;
    static deleteOldSessionWishlists(daysOld?: number): Promise<number>;
}
//# sourceMappingURL=customerController.d.ts.map