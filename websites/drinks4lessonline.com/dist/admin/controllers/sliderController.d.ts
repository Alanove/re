import { Request, Response, NextFunction } from 'express';
export declare class SliderController {
    static handleSliderUpload(req: Request, res: Response, next: NextFunction): void;
    static slider(req: Request, res: Response): Promise<void>;
    static createSlide(req: Request, res: Response): Promise<void>;
    static createSlidePost(req: Request, res: Response): Promise<void>;
    static editSlide(req: Request, res: Response): Promise<void>;
    static editSlidePost(req: Request, res: Response): Promise<void>;
    static deleteSlide(req: Request, res: Response): Promise<void>;
    static moveSlideUp(req: Request, res: Response): Promise<void>;
    static moveSlideDown(req: Request, res: Response): Promise<void>;
    static toggleSlideActive(req: Request, res: Response): Promise<void>;
    static uploadImage(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=sliderController.d.ts.map