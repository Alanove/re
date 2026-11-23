import { Request, Response } from 'express';
export declare class ProjectPhotosController {
    getAllProjectPhotos(req: Request, res: Response): Promise<void>;
    getCategories(req: Request, res: Response): Promise<void>;
    getProjectsByCategory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProjectsByCategorySlug(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProjectBySlugs(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchProjects(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProjectsByExtension(req: Request, res: Response): Promise<void>;
    getStatistics(req: Request, res: Response): Promise<void>;
    getCategoryBySlug(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
declare const _default: ProjectPhotosController;
export default _default;
//# sourceMappingURL=projectPhotosController.d.ts.map