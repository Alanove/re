import { Request, Response } from 'express';
export declare class ThemeController {
    static themeManagement(req: Request, res: Response): Promise<void>;
    static getCurrentTheme(req: Request, res: Response): void;
    static setTheme(req: Request, res: Response): void;
    static toggleDarkMode(req: Request, res: Response): void;
    static setDarkMode(req: Request, res: Response): void;
    static resetTheme(req: Request, res: Response): void;
    static getAvailableThemes(req: Request, res: Response): void;
    static exportTheme(req: Request, res: Response): void;
    static importTheme(req: Request, res: Response): void;
    static getThemeVariables(req: Request, res: Response): void;
}
//# sourceMappingURL=themeController.d.ts.map