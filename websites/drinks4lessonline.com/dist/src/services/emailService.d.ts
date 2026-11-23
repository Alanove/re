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
export declare class EmailService {
    private static instance;
    private transporter;
    private templatesPath;
    private constructor();
    static getInstance(): EmailService;
    resolveNotificationEmail(contactEmail?: string): string;
    private initializeTransporter;
    sendEmail(options: EmailOptions): Promise<boolean>;
    private loadTemplate;
    private replaceVariables;
    private getBrandingSettings;
    sendNewOrderNotification(adminEmail: string, orderNumber: string, customerName: string, customerEmail: string, orderData: {
        items: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
        total: number;
        shippingAddress: any;
        adminOrderUrl?: string;
        subtotal?: number;
        shipping?: number;
    }): Promise<boolean>;
    sendOrderConfirmation(orderNumber: string, customerEmail: string, customerName: string, orderData: {
        items: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
        subtotal: number;
        tax: number;
        shipping: number;
        discount: number;
        total: number;
        shippingAddress: any;
    }): Promise<boolean>;
    sendShippingUpdate(orderNumber: string, customerEmail: string, customerName: string, status: string, trackingNumber?: string): Promise<boolean>;
    sendPasswordReset(email: string, resetToken: string, resetUrl: string): Promise<boolean>;
    sendWelcomeEmail(email: string, name: string): Promise<boolean>;
    private escapeHtml;
    private formatAddress;
    testConnection(): Promise<boolean>;
}
declare const _default: EmailService;
export default _default;
//# sourceMappingURL=emailService.d.ts.map