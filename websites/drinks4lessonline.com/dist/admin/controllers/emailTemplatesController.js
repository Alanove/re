"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplatesController = void 0;
const emailTemplateService_1 = require("../../src/services/emailTemplateService");
class EmailTemplatesController {
    static async index(req, res) {
        try {
            const templates = await emailTemplateService_1.emailTemplateService.getAllTemplates();
            const error = req.query.error;
            const success = req.query.success;
            res.render('email-templates/list', {
                title: 'Email Templates',
                templates,
                user: req.user,
                url: req.originalUrl,
                error,
                success
            });
        }
        catch (error) {
            console.error('Error in EmailTemplatesController.index:', error);
            res.redirect('/admin/dashboard?error=' + encodeURIComponent('Failed to load email templates'));
        }
    }
    static async edit(req, res) {
        try {
            const { key } = req.params;
            const template = await emailTemplateService_1.emailTemplateService.getTemplate(key);
            const error = req.query.error;
            const success = req.query.success;
            if (!template) {
                res.redirect('/admin/email-templates?error=' + encodeURIComponent('Template not found'));
                return;
            }
            res.render('email-templates/edit', {
                title: `Edit Template: ${template.name}`,
                template,
                user: req.user,
                url: req.originalUrl,
                includeCustomEditor: true,
                error,
                success
            });
        }
        catch (error) {
            console.error('Error in EmailTemplatesController.edit:', error);
            res.redirect('/admin/email-templates?error=' + encodeURIComponent('Failed to load template for editing'));
        }
    }
    static async update(req, res) {
        try {
            const { key } = req.params;
            const { content } = req.body;
            if (!content) {
                res.redirect(`/admin/email-templates/${key}/edit?error=` + encodeURIComponent('Content cannot be empty'));
                return;
            }
            const success = await emailTemplateService_1.emailTemplateService.updateTemplate(key, content);
            if (success) {
                res.redirect(`/admin/email-templates/${key}/edit?success=` + encodeURIComponent('Template updated successfully'));
            }
            else {
                res.redirect(`/admin/email-templates/${key}/edit?error=` + encodeURIComponent('Failed to update template'));
            }
        }
        catch (error) {
            console.error('Error in EmailTemplatesController.update:', error);
            res.redirect(`/admin/email-templates/${req.params.key}/edit?error=` + encodeURIComponent('An error occurred while updating the template'));
        }
    }
}
exports.EmailTemplatesController = EmailTemplatesController;
//# sourceMappingURL=emailTemplatesController.js.map