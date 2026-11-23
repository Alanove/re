"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterController = void 0;
const newsletterService_1 = __importDefault(require("../services/newsletterService"));
function escapeCsvField(value) {
    if (value == null)
        return '';
    const s = String(value);
    if (/[",\r\n]/.test(s))
        return '"' + s.replace(/"/g, '""') + '"';
    return s;
}
class NewsletterController {
    static async list(req, res) {
        try {
            const subscribers = await newsletterService_1.default.getAll();
            const csrfToken = res.locals.csrfToken || '';
            res.render('newsletter/newsletter', {
                subscribers,
                csrfToken,
                title: typeof res.locals.t === 'function' ? res.locals.t('newsletter.title') : 'Newsletter'
            });
        }
        catch (error) {
            console.error('Newsletter list error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async exportCsv(req, res) {
        try {
            const subscribers = await newsletterService_1.default.getAll();
            const header = 'id,email,created_at';
            const rows = subscribers.map((s) => [s.id, escapeCsvField(s.email), escapeCsvField(s.created_at)].join(','));
            const csv = [header, ...rows].join('\r\n');
            const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send('\uFEFF' + csv);
        }
        catch (error) {
            console.error('Newsletter export CSV error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
exports.NewsletterController = NewsletterController;
//# sourceMappingURL=newsletterController.js.map