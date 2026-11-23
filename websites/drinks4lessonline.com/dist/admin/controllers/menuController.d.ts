import { Request, Response, RequestHandler } from 'express';
export declare class MenuController {
    static menus(req: Request, res: Response): Promise<void>;
    static createMenu(req: Request, res: Response): Promise<void>;
    static createMenuPost(req: Request, res: Response): Promise<void>;
    static editMenu(req: Request, res: Response): Promise<void>;
    static editMenuPost(req: Request, res: Response): Promise<void>;
    static deleteMenu(req: Request, res: Response): Promise<void>;
    static addMenuItem(req: Request, res: Response): Promise<void>;
    static updateMenuItem(req: Request, res: Response): Promise<void>;
    static deleteMenuItem(req: Request, res: Response): Promise<void>;
    static moveMenuItem(req: Request, res: Response): Promise<void>;
    static getMenuItems(req: Request, res: Response): Promise<void>;
    static getPages(req: Request, res: Response): Promise<void>;
    static uploadFile: RequestHandler[];
}
//# sourceMappingURL=menuController.d.ts.map