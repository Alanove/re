export interface ThemePanelOptions {
    showThemeColors?: boolean;
    showDarkMode?: boolean;
    showCustomSettings?: boolean;
    position?: 'right' | 'left';
    collapsed?: boolean;
}
export declare class ThemeHelpers {
    static getThemePanelHTML(options?: ThemePanelOptions): string;
    static getThemePanelCSS(): string;
    static getThemePanelJS(): string;
    static loadSavedTheme(): string;
}
//# sourceMappingURL=themeHelpers.d.ts.map