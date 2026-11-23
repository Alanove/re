import { Request, Response } from 'express';
import { OAuthProfile } from '../services/oauthService';
export declare class AuthController {
    static googleLogin(req: Request, res: Response): Promise<void>;
    static googleCallback(req: Request, res: Response): Promise<void>;
    static microsoftLogin(req: Request, res: Response): Promise<void>;
    static microsoftCallback(req: Request, res: Response): Promise<void>;
    static facebookLogin(req: Request, res: Response): Promise<void>;
    static facebookCallback(req: Request, res: Response): Promise<void>;
    static processOAuthProfile(req: Request, res: Response, profile: OAuthProfile): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map