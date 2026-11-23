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
exports.emailTemplateService = exports.EmailTemplateService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class EmailTemplateService {
    constructor() {
        const projectRoot = __dirname.includes('dist')
            ? path.resolve(__dirname, '../../../')
            : path.resolve(__dirname, '../../');
        this.templatesPath = path.join(projectRoot, 'email-templates');
        if (!fs.existsSync(this.templatesPath)) {
            fs.mkdirSync(this.templatesPath, { recursive: true });
        }
    }
    static getInstance() {
        if (!EmailTemplateService.instance) {
            EmailTemplateService.instance = new EmailTemplateService();
        }
        return EmailTemplateService.instance;
    }
    async getAllTemplates() {
        try {
            const files = fs.readdirSync(this.templatesPath);
            const templates = [];
            for (const file of files) {
                if (file.endsWith('.html')) {
                    const filePath = path.join(this.templatesPath, file);
                    const stats = fs.statSync(filePath);
                    const key = file.replace('.html', '');
                    templates.push({
                        key,
                        name: this.formatNameFromKey(key),
                        content: '',
                        lastModified: stats.mtime
                    });
                }
            }
            return templates.sort((a, b) => a.key.localeCompare(b.key));
        }
        catch (error) {
            console.error('Error listing email templates:', error);
            return [];
        }
    }
    async getTemplate(key) {
        try {
            const filePath = path.join(this.templatesPath, `${key}.html`);
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const stats = fs.statSync(filePath);
            return {
                key,
                name: this.formatNameFromKey(key),
                content,
                lastModified: stats.mtime
            };
        }
        catch (error) {
            console.error(`Error loading template ${key}:`, error);
            return null;
        }
    }
    async updateTemplate(key, content) {
        try {
            const filePath = path.join(this.templatesPath, `${key}.html`);
            fs.writeFileSync(filePath, content, 'utf-8');
            return true;
        }
        catch (error) {
            console.error(`Error updating template ${key}:`, error);
            throw error;
        }
    }
    formatNameFromKey(key) {
        return key
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}
exports.EmailTemplateService = EmailTemplateService;
exports.emailTemplateService = EmailTemplateService.getInstance();
//# sourceMappingURL=emailTemplateService.js.map