import { Request, Response } from 'express';
export declare class HomeController {
    static index(req: Request, res: Response): Promise<void>;
    static events(req: Request, res: Response): Promise<void>;
    static contactSubmit(req: Request, res: Response): Promise<void>;
    private static sponsorshipEmailBody;
    static sponsorshipSubmit(req: Request, res: Response): Promise<void>;
    static newsletterSubmit(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=homeController.d.ts.map