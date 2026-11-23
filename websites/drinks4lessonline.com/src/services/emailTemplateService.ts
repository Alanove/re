import * as fs from 'fs';
import * as path from 'path';

export interface EmailTemplate {
  key: string;
  name: string;
  content: string;
  lastModified: Date;
}

export class EmailTemplateService {
  private static instance: EmailTemplateService;
  private templatesPath: string;

  private constructor() {
    // Resolve from project root so it works in dev (src/) and production (dist/)
    const projectRoot = __dirname.includes('dist')
      ? path.resolve(__dirname, '../../../')
      : path.resolve(__dirname, '../../');
    this.templatesPath = path.join(projectRoot, 'email-templates');
    // Ensure directory exists
    if (!fs.existsSync(this.templatesPath)) {
      fs.mkdirSync(this.templatesPath, { recursive: true });
    }
  }

  public static getInstance(): EmailTemplateService {
    if (!EmailTemplateService.instance) {
      EmailTemplateService.instance = new EmailTemplateService();
    }
    return EmailTemplateService.instance;
  }

  /**
   * Get all available templates
   */
  public async getAllTemplates(): Promise<EmailTemplate[]> {
    try {
      const files = fs.readdirSync(this.templatesPath);
      const templates: EmailTemplate[] = [];

      for (const file of files) {
        if (file.endsWith('.html')) {
          const filePath = path.join(this.templatesPath, file);
          const stats = fs.statSync(filePath);
          const key = file.replace('.html', '');
          
          templates.push({
            key,
            name: this.formatNameFromKey(key),
            content: '', // Don't load content for list view to save memory
            lastModified: stats.mtime
          });
        }
      }

      return templates.sort((a, b) => a.key.localeCompare(b.key));
    } catch (error) {
      console.error('Error listing email templates:', error);
      return [];
    }
  }

  /**
   * Get a specific template by key (filename without extension)
   */
  public async getTemplate(key: string): Promise<EmailTemplate | null> {
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
    } catch (error) {
      console.error(`Error loading template ${key}:`, error);
      return null;
    }
  }

  /**
   * Update a template
   */
  public async updateTemplate(key: string, content: string): Promise<boolean> {
    try {
      const filePath = path.join(this.templatesPath, `${key}.html`);
      
      // Basic validation to ensure we don't write empty files if that's not desired
      // But allowing empty might be valid for some edge cases. 
      
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Error updating template ${key}:`, error);
      throw error;
    }
  }

  /**
   * Helper to format key into readable name
   * e.g. "order-confirmation" -> "Order Confirmation"
   */
  private formatNameFromKey(key: string): string {
    return key
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const emailTemplateService = EmailTemplateService.getInstance();
