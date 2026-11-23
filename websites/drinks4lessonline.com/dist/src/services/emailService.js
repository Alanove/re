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
exports.EmailService = void 0;
const nodemailer = __importStar(require("nodemailer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class EmailService {
    constructor() {
        this.transporter = null;
        const projectRoot = __dirname.includes('dist')
            ? path.resolve(__dirname, '../../../')
            : path.resolve(__dirname, '../../');
        this.templatesPath = path.join(projectRoot, 'email-templates');
        this.initializeTransporter();
    }
    static getInstance() {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }
    resolveNotificationEmail(contactEmail) {
        const trimmed = (contactEmail || '').trim();
        if (trimmed)
            return trimmed;
        const from = (process.env.SMTP_FROM || '').trim();
        if (from)
            return from;
        const test = (process.env.TEST_EMAIL || '').trim();
        if (test)
            return test;
        return 'info@example.com';
    }
    initializeTransporter() {
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
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
    async sendEmail(options) {
        try {
            this.initializeTransporter();
            if (!this.transporter) {
                console.error('Email transporter not initialized');
                return false;
            }
            const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
            const mailOptions = {
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
        }
        catch (error) {
            const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
            console.error(`Error sending email to ${to}:`, error);
            return false;
        }
    }
    async loadTemplate(templateName, variables = {}) {
        try {
            const templatePath = path.join(this.templatesPath, `${templateName}.html`);
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template ${templateName} not found`);
            }
            let html = fs.readFileSync(templatePath, 'utf-8');
            try {
                const ejs = await Promise.resolve().then(() => __importStar(require('ejs')));
                html = ejs.render(html, variables, {
                    delimiter: '%',
                });
            }
            catch (e) {
                console.warn('EJS render failed or not found, falling back to simple replacement', e);
            }
            const textPath = path.join(this.templatesPath, `${templateName}.txt`);
            let text = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf-8') : undefined;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                if (typeof value !== 'object' || value === null) {
                    html = html.replace(regex, String(value));
                    if (text) {
                        text = text.replace(regex, String(value));
                    }
                }
                else if (key === 'items' && typeof value === 'string') {
                    html = html.replace(regex, String(value));
                }
            }
            const subjectMatch = html.match(/<!--\s*SUBJECT:\s*(.+?)\s*-->/);
            const subject = subjectMatch ? subjectMatch[1] : 'Notification';
            return {
                subject: this.replaceVariables(subject, variables),
                html,
                ...(text ? { text } : {})
            };
        }
        catch (error) {
            console.error(`Error loading template ${templateName}:`, error);
            throw error;
        }
    }
    replaceVariables(str, variables) {
        let result = str;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            result = result.replace(regex, String(value));
        }
        return result;
    }
    async getBrandingSettings() {
        try {
            const { SiteSettingsService } = await Promise.resolve().then(() => __importStar(require('../../admin/services/siteSettingsService')));
            const settings = await SiteSettingsService.getInstance().getAllSettings();
            const defaults = {
                siteTitle: 'Drinks4Less',
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
                siteTitle: settings.siteTitle || defaults.siteTitle,
                siteUrl: settings.siteUrl || defaults.siteUrl
            };
        }
        catch (error) {
            console.error('Error fetching branding settings:', error);
            return {
                siteTitle: 'Drinks4Less',
                currentYear: new Date().getFullYear(),
                primaryColor: '#008e77',
                secondaryColor: '#F5F5F5',
                darkColor: '#012a2c',
                textColor: '#6C757D',
                lightColor: '#FFFFFF'
            };
        }
    }
    async sendNewOrderNotification(adminEmail, orderNumber, customerName, customerEmail, orderData) {
        try {
            const branding = await this.getBrandingSettings();
            const adminUrl = orderData.adminOrderUrl || `${branding.siteUrl}/admin/orders?search=${orderNumber}`;
            const n = (v) => Number(v) || 0;
            const items = orderData.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: n(item.price).toFixed(2),
                total: (item.quantity * n(item.price)).toFixed(2)
            }));
            const itemsTableHtml = items.length
                ? items.map(item => `<tr><td><div style="font-weight: bold;">${this.escapeHtml(item.name)}</div></td><td style="text-align: center;">${item.quantity}</td><td style="text-align: right;">$${item.price}</td><td style="text-align: right;">$${item.total}</td></tr>`).join('')
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
        }
        catch (error) {
            console.error('Error sending admin order notification:', error);
            return false;
        }
    }
    async sendOrderConfirmation(orderNumber, customerEmail, customerName, orderData) {
        try {
            const branding = await this.getBrandingSettings();
            const n = (v) => Number(v) || 0;
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
                itemsList: orderData.items.map(item => `${item.name} x${item.quantity} - $${n(item.price).toFixed(2)}`).join('<br>'),
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
        }
        catch (error) {
            console.error('Error sending order confirmation:', error);
            const total = Number(orderData.total) || 0;
            return this.sendEmail({
                to: customerEmail,
                subject: `Order Confirmation - ${orderNumber}`,
                html: `<h2>Order ${orderNumber} Confirmed</h2><p>Total: $${total.toFixed(2)}</p>`
            });
        }
    }
    async sendShippingUpdate(orderNumber, customerEmail, customerName, status, trackingNumber) {
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
        }
        catch (error) {
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
    async sendPasswordReset(email, resetToken, resetUrl) {
        try {
            const { SiteSettingsService } = await Promise.resolve().then(() => __importStar(require('../../admin/services/siteSettingsService')));
            const settings = await SiteSettingsService.getInstance().getAllSettings();
            const template = await this.loadTemplate('password-reset', {
                resetUrl,
                resetToken,
                expiryHours: 24,
                siteTitle: settings.siteTitle || 'Drinks4Less',
                logoUrl: settings.logo || 'https://via.placeholder.com/200x50?text=Logo',
                siteUrl: settings.siteUrl,
                currentYear: new Date().getFullYear(),
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
        }
        catch (error) {
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
    async sendWelcomeEmail(email, name) {
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
        }
        catch (error) {
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
    escapeHtml(s) {
        if (typeof s !== 'string')
            return String(s);
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    formatAddress(address) {
        if (typeof address === 'string') {
            try {
                address = JSON.parse(address);
            }
            catch {
                return address;
            }
        }
        const parts = [];
        if (address.address_line_1)
            parts.push(address.address_line_1);
        if (address.address_line_2)
            parts.push(address.address_line_2);
        if (address.city)
            parts.push(address.city);
        if (address.state)
            parts.push(address.state);
        if (address.postal_code)
            parts.push(address.postal_code);
        if (address.country)
            parts.push(address.country);
        return parts.join('<br>');
    }
    async testConnection() {
        try {
            this.initializeTransporter();
            if (!this.transporter) {
                return false;
            }
            await this.transporter.verify();
            return true;
        }
        catch (error) {
            console.error('Email connection test failed:', error);
            const response = (error?.response || '').toUpperCase();
            if (error?.code === 'EPROTOCOL' && (response.includes('IMAP') || response.includes('DOVECOT'))) {
                console.error('💡 You are connected to an IMAP server (receiving mail), not SMTP (sending). ' +
                    'Use your provider’s SMTP server and port (e.g. 587 or 465), not IMAP port 143 or 993.');
            }
            return false;
        }
    }
}
exports.EmailService = EmailService;
exports.default = EmailService.getInstance();
//# sourceMappingURL=emailService.js.map