interface ThemeConfig {
    [key: string]: any;
}
export declare class ThemeService {
    private static instance;
    private cacheTime;
    private cacheConfig;
    private cacheDuration;
    private constructor();
    static getInstance(): ThemeService;
    private loadConfig;
    getConfig(): Promise<ThemeConfig>;
    getSetting(key: string): Promise<any>;
    updateConfig(updates: Partial<ThemeConfig>): Promise<boolean>;
    deleteSetting(key: string): Promise<boolean>;
    reloadConfig(): void;
    getThemeClasses(): Promise<string[]>;
    getCurrentTheme(): Promise<string>;
}
export declare const themeService: ThemeService;
export {};
//# sourceMappingURL=themeService.d.ts.map