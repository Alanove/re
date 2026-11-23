"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18nService = exports.I18nService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class I18nService {
    constructor() {
        this.translations = new Map();
        this.defaultLanguage = 'en';
        this.loadTranslations();
    }
    static getInstance() {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }
        return I18nService.instance;
    }
    loadTranslations() {
        const localesDir = path.resolve(process.cwd(), 'data', 'locales');
        const languages = ['en', 'ru', 'fr', 'ar'];
        languages.forEach(lang => {
            try {
                const filePath = path.join(localesDir, `${lang}.json`);
                if (fs.existsSync(filePath)) {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const translations = JSON.parse(fileContent);
                    this.translations.set(lang, translations);
                    console.log(`✅ Loaded translations for language: ${lang}`);
                }
                else {
                    console.warn(`⚠️ Translation file not found: ${filePath}`);
                }
            }
            catch (error) {
                console.error(`❌ Error loading translations for ${lang}:`, error);
            }
        });
    }
    translate(key, lang = 'en', params) {
        if (!this.translations.has(lang)) {
            lang = this.defaultLanguage;
        }
        const translations = this.translations.get(lang) || {};
        const value = this.getNestedValue(translations, key);
        if (typeof value === 'string') {
            if (params) {
                return this.replaceParams(value, params);
            }
            return value;
        }
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
        console.warn(`⚠️ Translation key not found: ${key} (language: ${lang})`);
        return key;
    }
    getNestedValue(obj, key) {
        const keys = key.split('.');
        let current = obj;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            }
            else {
                return undefined;
            }
        }
        return current;
    }
    replaceParams(text, params) {
        let result = text;
        for (const [key, value] of Object.entries(params)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return result;
    }
    isSupportedLanguage(lang) {
        return ['en', 'ru', 'fr', 'ar'].includes(lang);
    }
    getSupportedLanguages() {
        return ['en', 'ru', 'fr', 'ar'];
    }
    getDefaultLanguage() {
        return this.defaultLanguage;
    }
    reloadTranslations() {
        this.translations.clear();
        this.loadTranslations();
    }
    getLanguageName(lang) {
        const names = {
            en: 'English',
            ru: 'Русский',
            fr: 'Français',
            ar: 'العربية'
        };
        return names[lang] || lang;
    }
    getTranslations(req) {
        let language = this.defaultLanguage;
        if (req) {
            const langCookie = req.cookies?.language || req.cookies?.lang;
            if (langCookie && this.isSupportedLanguage(langCookie)) {
                language = langCookie;
            }
            else if (req.headers?.['accept-language']) {
                const acceptLang = req.headers['accept-language'].split(',')[0].split('-')[0].toLowerCase();
                if (this.isSupportedLanguage(acceptLang)) {
                    language = acceptLang;
                }
            }
        }
        return (key, params) => {
            return this.translate(key, language, params);
        };
    }
}
exports.I18nService = I18nService;
exports.i18nService = I18nService.getInstance();
exports.default = exports.i18nService;
//# sourceMappingURL=i18nService.js.map