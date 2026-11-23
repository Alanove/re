import { Request, Response } from 'express';
export declare class EcommerceSettingsController {
    private static getAramexDefaults;
    static index(req: Request, res: Response): Promise<void>;
    static updateSettings(req: Request, res: Response): Promise<void>;
    static createShippingZone(req: Request, res: Response): Promise<void>;
    static updateShippingZone(req: Request, res: Response): Promise<void>;
    static deleteShippingZone(req: Request, res: Response): Promise<void>;
    static createShippingRate(req: Request, res: Response): Promise<void>;
    static updateShippingRate(req: Request, res: Response): Promise<void>;
    static deleteShippingRate(req: Request, res: Response): Promise<void>;
    static updatePaymentMethod(req: Request, res: Response): Promise<void>;
    static testAramexShipping(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=ecommerceSettingsController.d.ts.map