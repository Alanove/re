export interface EmailTemplate {
    key: string;
    name: string;
    content: string;
    lastModified: Date;
}
export declare class EmailTemplateService {
    private static instance;
    private templatesPath;
    private constructor();
    static getInstance(): EmailTemplateService;
    getAllTemplates(): Promise<EmailTemplate[]>;
    getTemplate(key: string): Promise<EmailTemplate | null>;
    updateTemplate(key: string, content: string): Promise<boolean>;
    private formatNameFromKey;
}
export declare const emailTemplateService: EmailTemplateService;
//# sourceMappingURL=emailTemplateService.d.ts.map