import { Express } from 'express';
export declare class MiddlewareService {
    private static instance;
    private siteSettingsService;
    private categoryCache;
    private featuredCache;
    private readonly CACHE_TTL_MS;
    private constructor();
    static getInstance(): MiddlewareService;
    configureGeneralMiddleware(app: Express): void;
}
export declare const middlewareService: MiddlewareService;
export default middlewareService;
//# sourceMappingURL=middlewareService.d.ts.map