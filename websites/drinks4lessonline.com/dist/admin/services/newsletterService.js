"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterService = void 0;
const database_1 = require("../../src/config/database");
const encryptionService_1 = __importDefault(require("../../src/services/encryptionService"));
class NewsletterService {
    static getInstance() {
        if (!NewsletterService.instance) {
            NewsletterService.instance = new NewsletterService();
        }
        return NewsletterService.instance;
    }
    async getAll() {
        const [rows] = await database_1.db.query('SELECT id, content_encrypted, iv, created_at FROM newsletter_subscribers ORDER BY created_at DESC');
        const result = [];
        for (const row of rows) {
            try {
                const decrypted = encryptionService_1.default.decrypt(row.content_encrypted, row.iv);
                const email = decrypted?.email || '(decrypt failed)';
                result.push({
                    id: row.id,
                    email,
                    created_at: row.created_at
                });
            }
            catch (e) {
                result.push({ id: row.id, email: '(error)', created_at: row.created_at });
            }
        }
        return result;
    }
}
exports.NewsletterService = NewsletterService;
exports.default = NewsletterService.getInstance();
//# sourceMappingURL=newsletterService.js.map