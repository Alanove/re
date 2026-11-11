import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private templatesPath: string;

  private constructor() {
    // Resolve from project root so it works in dev (src/) and production (dist/)
    const projectRoot = __dirname.includes('dist')
      ? path.resolve(__dirname, '../../../')
      : path.resolve(__dirname, '../../');
    this.templatesPath = path.join(projectRoot, 'email-templates');
    this.initializeTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Resolve the admin/notification inbox for contact forms, sponsorship, etc.
   */
  public resolveNotificationEmail(contactEmail?: string): string {
    const trimmed = (contactEmail || '').trim();
    if (trimmed) return trimmed;
    const from = (process.env.SMTP_FROM || '').trim();
    if (from) return from;
    const test = (process.env.TEST_EMAIL || '').trim();
    if (test) return test;
    return 'info@example.com';
  }

  /**
   * Initialize email transporter (re-reads env each call so .env changes apply without restart)
   */
  private initializeTransporter(): void {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    // Port 465 = implicit TLS (smtps); use secure: true. 587/25 = STARTTLS; use secure: false.
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port,
      secure,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      } : undefined,
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
      }
    };

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  /**
   * Send email
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      this.initializeTransporter();

      if (!this.transporter) {
        console.error('Email transporter not initialized');
        return false;
      }

      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from || process.env.SMTP_FROM || 'noreply@example.com',
        to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
        console.log(`Email sent to ${to}:`, info.messageId);
      }
      return true;
    } catch (error) {
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      console.error(`Error sending email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Load email template
   */
  /**
   * Load email template
   */
  private async loadTemplate(templateName: string, variables: Record<string, any> = {}): Promise<EmailTemplate> {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.html`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template ${templateName} not found`);
      }

      let html = fs.readFileSync(templatePath, 'utf-8');

      // Upgrade to EJS rendering if available (assuming ejs is in dependencies)
      try {
        // @ts-ignore
        const ejs = await import('ejs');
        html = ejs.render(html, variables, {
          delimiter: '%', // default
          // Support Handlebars-like syntax strictly for legacy compatibility? 
          // No, simple regex replace is better for minimal change, BUT
          // I need to support {{#if discount}} style logic or standard EJS.
          // Since I am rewriting the template, I will use EJS logic in the template.
          // But I also want to support existing templates.
        });

        // Use regex for any remaining {{ }} logic if EJS didn't handle it
        // Or if the template just used basic {{ var }}
        // Actually, let's stick to EJS for the new template and keep regex for others?
        // Better: Use regex as fallback or pre-processor.
        // Wait, EJS won't touch {{ }}. 
      } catch (e) {
        console.warn('EJS render failed or not found, falling back to simple replacement', e);
      }

      const textPath = path.join(this.templatesPath, `${templateName}.txt`);
      let text = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf-8') : undefined;

      // Replace variables (Legacy support for {{ var }})
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        // Check if value is object (array), if so, skip (EJS should handle loops)
        if (typeof value !== 'object' || value === null) {
          html = html.replace(regex, String(value));
          if (text) {
            text = text.replace(regex, String(value));
          }
        } else if (key === 'items' && typeof value === 'string') {
          // Handle the 'items' string case for backward compat
          html = html.replace(regex, String(value));
        }
      }

      // Also handle basic {{#if var}}...{{/if}} for simple boolean checks if not using EJS
      // (This is a simplified polyfill for the user request without full Handlebars)
      // Actually, let's just use EJS syntax in the template I edit.

      // Extract subject from template (look for <!-- SUBJECT: ... -->)
      const subjectMatch = html.match(/<!--\s*SUBJECT:\s*(.+?)\s*-->/);
      const subject = subjectMatch ? subjectMatch[1] : 'Notification';

      return {
        subject: this.replaceVariables(subject, variables),
        html,
        ...(text ? { text } : {})
      };
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Replace variables in string
   */
  private replaceVariables(str: string, variables: Record<string, any>): string {
    let result = str;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * Get branding settings
   */
  private async getBrandingSettings(): Promise<any> {
    try {
      const { SiteSettingsService } = await import('../../admin/services/siteSettingsService');
      const settings = await SiteSettingsService.getInstance().getAllSettings();

      const defaults = {
        siteTitle: 'Guerra Sports',
        logoUrl: 'https://via.placeholder.com/200x50?text=Logo',
        siteUrl: process.env.SITE_URL || 'http://localhost:3000',
        currentYear: new Date().getFullYear(),
        primaryColor: '#008e77',
        secondaryColor: '#F5F5F5',
        darkColor: '#012a2c',
        textColor: '#6C757D',
        lightColor: '#FFFFFF'
      };

      return {
        ...defaults,
        ...settings,
        // Ensure critical fallback if settings has nulls
        siteTitle: settings.siteTitle || defaults.siteTitle,
        siteUrl: settings.siteUrl || defaults.siteUrl
      };
    } catch (error) {
      console.error('Error fetching branding settings:', error);
      return {
        siteTitle: 'Guerra Sports',
        currentYear: new Date().getFullYear(),
        primaryColor: '#008e77',
        secondaryColor: '#F5F5F5',
        darkColor: '#012a2c',
        textColor: '#6C757D',
        lightColor: '#FFFFFF'
      };
    }
  }

  /**
   * Send new order notification to admin
   */
  public async sendNewOrderNotification(
    adminEmail: string,
    orderNumber: string,
    customerName: string,
    customerEmail: string,
    orderData: {
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      shippingAddress: any;
      adminOrderUrl?: string;
      subtotal?: number;
      shipping?: number;
    }
  ): Promise<boolean> {
    try {
      const branding = await this.getBrandingSettings();
      const adminUrl = orderData.adminOrderUrl || `${branding.siteUrl}/admin/orders?search=${orderNumber}`;
      const n = (v: unknown) => Number(v) || 0;

      const items = orderData.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: n(item.price).toFixed(2),
        total: (item.quantity * n(item.price)).toFixed(2)
      }));
      const itemsTableHtml = items.length
        ? items.map(item =>
            `<tr><td><div style="font-weight: bold;">${this.escapeHtml(item.name)}</div></td><td style="text-align: center;">${item.quantity}</td><td style="text-align: right;">$${item.price}</td><td style="text-align: right;">$${item.total}</td></tr>`
          ).join('')
        : '<tr><td colspan="4" style="text-align: center; color: #666;">No items</td></tr>';
      const itemsList = items.length
        ? items.map(item => `${item.name} x${item.quantity} - $${item.price}`).join('<br>')
        : 'No items';

      const template = await this.loadTemplate('admin-new-order', {
        ...branding,
        orderNumber,
        customerName,
        customerEmail,
        items,
        itemsList,
        itemsTableHtml,
        subtotal: orderData.subtotal != null ? n(orderData.subtotal).toFixed(2) : null,
        shipping: orderData.shipping != null ? n(orderData.shipping).toFixed(2) : null,
        total: n(orderData.total).toFixed(2),
        shippingAddress: this.formatAddress(orderData.shippingAddress),
        adminOrderUrl: adminUrl
      });

      return await this.sendEmail({
        to: adminEmail,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {})
      });
    } catch (error) {
      console.error('Error sending admin order notification:', error);
      return false; // Don't throw, just log
    }
  }

  /**
   * Send order confirmation email
   */
  public async sendOrderConfirmation(
    orderNumber: string,
    customerEmail: string,
    customerName: string,
    orderData: {
      items: Array<{ name: string; quantity: number; price: number }>;
      subtotal: number;
      tax: number;
      shipping: number;
      discount: number;
      total: number;
      shippingAddress: any;
    }
  ): Promise<boolean> {
    try {
      const branding = await this.getBrandingSettings();

      // Coerce to number (DB may return DECIMAL as string)
      const n = (v: unknown) => Number(v) || 0;
      const template = await this.loadTemplate('order-confirmation', {
        ...branding,
        orderNumber,
        customerName,
        items: orderData.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: n(item.price).toFixed(2),
          total: (item.quantity * n(item.price)).toFixed(2)
        })),
        rawItems: orderData.items,
        itemsList: orderData.items.map(item =>
          `${item.name} x${item.quantity} - $${n(item.price).toFixed(2)}`
        ).join('<br>'),
        subtotal: n(orderData.subtotal).toFixed(2),
        tax: n(orderData.tax).toFixed(2),
        shipping: n(orderData.shipping).toFixed(2),
        discount: n(orderData.discount) > 0 ? n(orderData.discount).toFixed(2) : null,
        hasDiscount: n(orderData.discount) > 0,
        total: n(orderData.total).toFixed(2),
        shippingAddress: this.formatAddress(orderData.shippingAddress)
      });

      return await this.sendEmail({
        to: customerEmail,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {})
      });
    } catch (error) {
      console.error('Error sending order confirmation:', error);
      const total = Number(orderData.total) || 0;
      return this.sendEmail({
        to: customerEmail,
        subject: `Order Confirmation - ${orderNumber}`,
        html: `<h2>Order ${orderNumber} Confirmed</h2><p>Total: $${total.toFixed(2)}</p>`
      });
    }
  }

  /**
   * Send shipping update email
   */
  public async sendShippingUpdate(
    orderNumber: string,
    customerEmail: string,
    customerName: string,
    status: string,
    trackingNumber?: string
  ): Promise<boolean> {
    try {
      const template = await this.loadTemplate('shipping-update', {
        orderNumber,
        customerName,
        status,
        trackingNumber: trackingNumber || 'N/A'
      });

      return await this.sendEmail({
        to: customerEmail,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {})
      });
    } catch (error) {
      console.error('Error sending shipping update:', error);
      return await this.sendEmail({
        to: customerEmail,
        subject: `Shipping Update - Order ${orderNumber}`,
        html: `
          <h2>Shipping Update</h2>
          <p>Your order ${orderNumber} status: ${status}</p>
          ${trackingNumber ? `<p>Tracking Number: ${trackingNumber}</p>` : ''}
        `
      });
    }
  }

  /**
   * Send password reset email
   */
  /**
   * Send password reset email
   */
  public async sendPasswordReset(
    email: string,
    resetToken: string,
    resetUrl: string
  ): Promise<boolean> {
    try {
      // Get site settings for branding
      const { SiteSettingsService } = await import('../../admin/services/siteSettingsService');
      const settings = await SiteSettingsService.getInstance().getAllSettings();

      const template = await this.loadTemplate('password-reset', {
        resetUrl,
        resetToken,
        expiryHours: 24,
        siteTitle: settings.siteTitle || 'Guerra Sports',
        logoUrl: settings.logo || 'https://via.placeholder.com/200x50?text=Logo',
        siteUrl: settings.siteUrl,
        currentYear: new Date().getFullYear(),
        // Brand colors
        primaryColor: '#008e77',
        secondaryColor: '#F5F5F5',
        darkColor: '#012a2c',
        textColor: '#6C757D',
        lightColor: '#FFFFFF'
      });

      return await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {})
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      return await this.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset</h2>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link will expire in 24 hours.</p>
        `
      });
    }
  }

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(
    email: string,
    name: string
  ): Promise<boolean> {
    try {
      const template = await this.loadTemplate('welcome', {
        name
      });

      return await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        ...(template.text ? { text: template.text } : {})
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return await this.sendEmail({
        to: email,
        subject: 'Welcome!',
        html: `
          <h2>Welcome, ${name}!</h2>
          <p>Thank you for registering with us.</p>
        `
      });
    }
  }

  /**
   * Escape HTML for safe insertion into email body
   */
  private escapeHtml(s: string): string {
    if (typeof s !== 'string') return String(s);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format address for display
   */
  private formatAddress(address: any): string {
    if (typeof address === 'string') {
      try {
        address = JSON.parse(address);
      } catch {
        return address;
      }
    }

    const parts: string[] = [];
    if (address.address_line_1) parts.push(address.address_line_1);
    if (address.address_line_2) parts.push(address.address_line_2);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.postal_code) parts.push(address.postal_code);
    if (address.country) parts.push(address.country);

    return parts.join('<br>');
  }

  /**
   * Test email configuration
   */
  public async testConnection(): Promise<boolean> {
    try {
      this.initializeTransporter();
      if (!this.transporter) {
        return false;
      }
      await this.transporter.verify();
      return true;
    } catch (error: any) {
      console.error('Email connection test failed:', error);
      // Detect wrong protocol: IMAP response (Dovecot) means SMTP_PORT/host is pointing at IMAP (143/993) not SMTP (587/465/25)
      const response = (error?.response || '').toUpperCase();
      if (error?.code === 'EPROTOCOL' && (response.includes('IMAP') || response.includes('DOVECOT'))) {
        console.error(
          '💡 You are connected to an IMAP server (receiving mail), not SMTP (sending). ' +
          'Use your provider’s SMTP server and port (e.g. 587 or 465), not IMAP port 143 or 993.'
        );
      }
      return false;
    }
  }
}

export default EmailService.getInstance();

