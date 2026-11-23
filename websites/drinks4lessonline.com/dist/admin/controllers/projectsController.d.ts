import { Request, Response } from 'express';
export declare class ProjectsController {
    static projects(req: Request, res: Response): Promise<void>;
    static createProject(req: Request, res: Response): Promise<void>;
    static createProjectPost(req: Request, res: Response): Promise<void>;
    static editProject(req: Request, res: Response): Promise<void>;
    static editProjectPost(req: Request, res: Response): Promise<void>;
    static deleteProjectImage(req: Request, res: Response): Promise<Response | void>;
    static deleteProject(req: Request, res: Response): Promise<Response | void>;
    static addWorkToProject(req: Request, res: Response): Promise<void>;
    static updateWorkInProject(req: Request, res: Response): Promise<any>;
    static deleteWorkImage(req: Request, res: Response): Promise<Response | void>;
    static deleteWorkFromProject(req: Request, res: Response): Promise<Response | void>;
}
//# sourceMappingURL=projectsController.d.ts.map