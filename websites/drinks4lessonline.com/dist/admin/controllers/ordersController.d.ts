import { Request, Response } from 'express';
export declare class OrdersController {
    static index(req: Request, res: Response): Promise<void>;
    static detail(req: Request, res: Response): Promise<void>;
    static updateStatus(req: Request, res: Response): Promise<void>;
    static updateNotes(req: Request, res: Response): Promise<void>;
    static editCart(req: Request, res: Response): Promise<void>;
    static updateCart(req: Request, res: Response): Promise<void>;
    static getProductsForCart(req: Request, res: Response): Promise<void>;
    static schedulePickup(req: Request, res: Response): Promise<void>;
    static schedulePickupAndWaybill(req: Request, res: Response): Promise<void>;
    static createWaybill(req: Request, res: Response): Promise<void>;
    static printWaybill(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=ordersController.d.ts.map