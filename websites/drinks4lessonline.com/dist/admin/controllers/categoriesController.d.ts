import { Request, Response } from 'express';
export declare class CategoriesController {
    static index(req: Request, res: Response): Promise<void>;
    static createCategory(req: Request, res: Response): Promise<void>;
    static createCategoryPost(req: Request, res: Response): Promise<void>;
    static editCategory(req: Request, res: Response): Promise<void>;
    static editCategoryPost(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
    static deleteCategoryImage(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=categoriesController.d.ts.map