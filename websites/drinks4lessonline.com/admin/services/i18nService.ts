import * as fs from 'fs';
import * as path from 'path';

export type SupportedLanguage = 'en' | 'ru' | 'fr' | 'ar';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

export class I18nService {
  private static instance: I18nService;
  private translations: Map<SupportedLanguage, TranslationObject> = new Map();
  private defaultLanguage: SupportedLanguage = 'en';

  private constructor() {
    this.loadTranslations();
  }

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * Load all translation files from data/locales directory
   */
  private loadTranslations(): void {
    const localesDir = path.resolve(process.cwd(), 'data', 'locales');
    const languages: SupportedLanguage[] = ['en', 'ru', 'fr', 'ar'];

    languages.forEach(lang => {
      try {
        const filePath = path.join(localesDir, `${lang}.json`);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const translations = JSON.parse(fileContent);
          this.translations.set(lang, translations);
          console.log(`✅ Loaded translations for language: ${lang}`);
        } else {
          console.warn(`⚠️ Translation file not found: ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error loading translations for ${lang}:`, error);
      }
    });
  }

  /**
   * Get translation for a key in the specified language
   * Supports nested keys using dot notation (e.g., 'menu.dashboard')
   * 
   * @param key Translation key (supports nested keys with dots)
   * @param lang Language code (defaults to 'en')
   * @param params Optional parameters to replace in translation string
   * @returns Translated string or the key if translation not found
   */
  public translate(key: string, lang: SupportedLanguage = 'en', params?: Record<string, string | number>): string {
    // Fallback to default language if specified language not available
    if (!this.translations.has(lang)) {
      lang = this.defaultLanguage;
    }

    const translations = this.translations.get(lang) || {};
    
    // Get nested value using dot notation
    const value = this.getNestedValue(translations, key);
    
    if (typeof value === 'string') {
      // Replace parameters if provided
      if (params) {
        return this.replaceParams(value, params);
      }
      return value;
    }

    // If not found in specified language, try default language
    if (lang !== this.defaultLanguage) {
      const defaultTranslations = this.translations.get(this.defaultLanguage) || {};
      const defaultValue = this.getNestedValue(defaultTranslations, key);
      if (typeof defaultValue === 'string') {
        if (params) {
          return this.replaceParams(defaultValue, params);
        }
        return defaultValue;
      }
    }

    // Return key if translation not found
    console.warn(`⚠️ Translation key not found: ${key} (language: ${lang})`);
    return key;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: TranslationObject, key: string): string | TranslationObject | undefined {
    const keys = key.split('.');
    let current: any = obj;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Replace parameters in translation string
   * Supports {paramName} syntax
   */
  private replaceParams(text: string, params: Record<string, string | number>): string {
    let result = text;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * Check if a language is supported
   */
  public isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return ['en', 'ru', 'fr', 'ar'].includes(lang);
  }

  /**
   * Get all supported languages
   */
  public getSupportedLanguages(): SupportedLanguage[] {
    return ['en', 'ru', 'fr', 'ar'];
  }

  /**
   * Get default language
   */
  public getDefaultLanguage(): SupportedLanguage {
    return this.defaultLanguage;
  }

  /**
   * Reload translations (useful for development)
   */
  public reloadTranslations(): void {
    this.translations.clear();
    this.loadTranslations();
  }

  /**
   * Get language name in that language
   */
  public getLanguageName(lang: SupportedLanguage): string {
    const names: Record<SupportedLanguage, string> = {
      en: 'English',
      ru: 'Русский',
      fr: 'Français',
      ar: 'العربية'
    };
    return names[lang] || lang;
  }

  /**
   * Get translations function for use in views
   * Returns a function that can be called with translation keys
   * 
   * @param req Express request object (optional, for language detection)
   * @returns Translation function
   */
  public getTranslations(req?: any): (key: string, params?: Record<string, string | number>) => string {
    // Determine language from request (cookie, header, or default)
    let language: SupportedLanguage = this.defaultLanguage;
    
    if (req) {
      // Try to get language from cookie
      const langCookie = req.cookies?.language || req.cookies?.lang;
      if (langCookie && this.isSupportedLanguage(langCookie)) {
        language = langCookie;
      }
      // Try to get from Accept-Language header
      else if (req.headers?.['accept-language']) {
        const acceptLang = req.headers['accept-language'].split(',')[0].split('-')[0].toLowerCase();
        if (this.isSupportedLanguage(acceptLang)) {
          language = acceptLang;
        }
      }
    }

    // Return translation function bound to the determined language
    return (key: string, params?: Record<string, string | number>): string => {
      return this.translate(key, language, params);
    };
  }
}

export const i18nService = I18nService.getInstance();
export default i18nService;

