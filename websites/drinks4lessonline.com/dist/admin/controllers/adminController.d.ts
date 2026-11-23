import { Request, Response } from 'express';
export declare class AdminController {
    static login(req: Request, res: Response): Promise<void>;
    private static verifyTurnstileToken;
    static loginPost(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static requireAuth(req: Request, res: Response, next: Function): void;
    static requireApiAuth(req: Request, res: Response, next: Function): void;
}
//# sourceMappingURL=adminController.d.ts.map