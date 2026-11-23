export interface NewsletterSubscriber {
    id: number;
    email: string;
    created_at: string;
}
export declare class NewsletterService {
    private static instance;
    static getInstance(): NewsletterService;
    getAll(): Promise<NewsletterSubscriber[]>;
}
declare const _default: NewsletterService;
export default _default;
//# sourceMappingURL=newsletterService.d.ts.map