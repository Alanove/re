export type SupportedLanguage = 'en' | 'ru' | 'fr' | 'ar';
export declare class I18nService {
    private static instance;
    private translations;
    private defaultLanguage;
    private constructor();
    static getInstance(): I18nService;
    private loadTranslations;
    translate(key: string, lang?: SupportedLanguage, params?: Record<string, string | number>): string;
    private getNestedValue;
    private replaceParams;
    isSupportedLanguage(lang: string): lang is SupportedLanguage;
    getSupportedLanguages(): SupportedLanguage[];
    getDefaultLanguage(): SupportedLanguage;
    reloadTranslations(): void;
    getLanguageName(lang: SupportedLanguage): string;
    getTranslations(req?: any): (key: string, params?: Record<string, string | number>) => string;
}
export declare const i18nService: I18nService;
export default i18nService;
//# sourceMappingURL=i18nService.d.ts.map