import { Request, Response } from 'express';
export declare class NewsController {
    static list(req: Request, res: Response): Promise<void>;
    static article(req: Request, res: Response): Promise<void>;
    static listByYear(req: Request, res: Response): Promise<void>;
    static listByMonth(req: Request, res: Response): Promise<void>;
    static listByDay(req: Request, res: Response): Promise<void>;
    static listByTag(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=newsController.d.ts.map