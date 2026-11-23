import { Express, Request } from 'express';
export declare class SecurityService {
    private static instance;
    csrfProtection: any;
    private constructor();
    static getInstance(): SecurityService;
    configureHelmet(app: Express): void;
    configureSession(app: Express): void;
    configureCookieSecureMiddleware(app: Express): void;
    configureSessionDebugMiddleware(app: Express): void;
    getCsrfTokenFromRequest(req: Request): string | null;
    configureCsrfProtection(app: Express): void;
    configureCsrfTokenInJsonResponse(app: Express): void;
    configureCsrfErrorHandler(app: Express): void;
    configureSecurity(app: Express): void;
}
export declare const securityService: SecurityService;
export default securityService;
//# sourceMappingURL=securityService.d.ts.map