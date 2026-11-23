import { Request, Response } from 'express';
import { emailTemplateService } from '../../src/services/emailTemplateService';

export class EmailTemplatesController {
  
  /**
   * List all email templates
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const templates = await emailTemplateService.getAllTemplates();
      const error = req.query.error as string | undefined;
      const success = req.query.success as string | undefined;
      
      res.render('email-templates/list', {
        title: 'Email Templates',
        templates,
        user: (req as any).user,
        url: req.originalUrl,
        error,
        success
      });
    } catch (error) {
      console.error('Error in EmailTemplatesController.index:', error);
      res.redirect('/admin/dashboard?error=' + encodeURIComponent('Failed to load email templates'));
    }
  }

  /**
   * Show edit form for a template
   */
  public static async edit(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const template = await emailTemplateService.getTemplate(key);
      const error = req.query.error as string | undefined;
      const success = req.query.success as string | undefined;
      
      if (!template) {
        res.redirect('/admin/email-templates?error=' + encodeURIComponent('Template not found'));
        return;
      }
      
      res.render('email-templates/edit', {
        title: `Edit Template: ${template.name}`,
        template,
        user: (req as any).user,
        url: req.originalUrl,
        includeCustomEditor: true, // Flag to include editor assets in layout
        error,
        success
      });
    } catch (error) {
      console.error('Error in EmailTemplatesController.edit:', error);
      res.redirect('/admin/email-templates?error=' + encodeURIComponent('Failed to load template for editing'));
    }
  }

  /**
   * Update a template
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { content } = req.body;
      
      // Basic validation
      if (!content) {
        res.redirect(`/admin/email-templates/${key}/edit?error=` + encodeURIComponent('Content cannot be empty'));
        return;
      }
      
      const success = await emailTemplateService.updateTemplate(key, content);
      
      if (success) {
        res.redirect(`/admin/email-templates/${key}/edit?success=` + encodeURIComponent('Template updated successfully'));
      } else {
        res.redirect(`/admin/email-templates/${key}/edit?error=` + encodeURIComponent('Failed to update template'));
      }
    } catch (error) {
      console.error('Error in EmailTemplatesController.update:', error);
      res.redirect(`/admin/email-templates/${req.params.key}/edit?error=` + encodeURIComponent('An error occurred while updating the template'));
    }
  }
}
