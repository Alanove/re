import { Request, Response } from 'express';
export declare class ProductsController {
    static index(req: Request, res: Response): Promise<void>;
    static create(req: Request, res: Response): Promise<void>;
    static createPost(req: Request, res: Response): Promise<void>;
    static edit(req: Request, res: Response): Promise<void>;
    static editPost(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
    static uploadImage(req: Request, res: Response): Promise<void>;
    static deleteImage(req: Request, res: Response): Promise<void>;
    static copy(req: Request, res: Response): Promise<void>;
    static setPrimaryImage(req: Request, res: Response): Promise<void>;
    static reorderImage(req: Request, res: Response): Promise<void>;
    static getImages(req: Request, res: Response): Promise<void>;
    static createVariant(req: Request, res: Response): Promise<void>;
    static updateVariant(req: Request, res: Response): Promise<void>;
    static deleteVariant(req: Request, res: Response): Promise<void>;
    static uploadVariantImage(req: Request, res: Response): Promise<void>;
    static deleteVariantImage(req: Request, res: Response): Promise<void>;
    static getProductAttributes(req: Request, res: Response): Promise<void>;
    static addProductAttribute(req: Request, res: Response): Promise<void>;
    static removeProductAttribute(req: Request, res: Response): Promise<void>;
    static updateAttributeSelection(req: Request, res: Response): Promise<void>;
    static uploadAttributeValueImage(req: Request, res: Response): Promise<void>;
    static deleteAttributeValueImage(req: Request, res: Response): Promise<void>;
    static resetAllVariantStocks(req: Request, res: Response): Promise<void>;
    static createBulkVariants(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=productsController.d.ts.map