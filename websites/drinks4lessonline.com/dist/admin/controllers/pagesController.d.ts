import { Request, Response, RequestHandler } from 'express';
export declare class PagesController {
    static pages(req: Request, res: Response): Promise<void>;
    static tags(req: Request, res: Response): Promise<void>;
    static createPage(req: Request, res: Response): Promise<void>;
    static createPagePost(req: Request, res: Response): Promise<void>;
    static editPage(req: Request, res: Response): Promise<void>;
    static editPagePost(req: Request, res: Response): Promise<void>;
    static deletePage(req: Request, res: Response): Promise<void>;
    static checkPageKey(req: Request, res: Response): Promise<void>;
    static checkPageUrl(req: Request, res: Response): Promise<void>;
    static deletePageImage(req: Request, res: Response): Promise<void>;
    static uploadImage(req: Request, res: Response): Promise<void>;
    static getPageImages(req: Request, res: Response): Promise<void>;
    static getPublicImages(req: Request, res: Response): Promise<void>;
    private static getImagesFromDirectory;
    static uploadPagePhotos(req: Request, res: Response): Promise<void>;
    static getPagePhotos(req: Request, res: Response): Promise<void>;
    static uploadPageFile: RequestHandler[];
    static deletePageGalleryPhoto(req: Request, res: Response): Promise<void>;
    static reorderPagePhotos(req: Request, res: Response): Promise<void>;
    static fetchVideoEmbed(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=pagesController.d.ts.map