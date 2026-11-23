declare class EnhanceProductRelationsMigration {
    private connection;
    connect(): Promise<void>;
    run(): Promise<{
        success: boolean;
        message: string;
        error?: string;
    }>;
    rollback(): Promise<{
        success: boolean;
        message: string;
        error?: string;
    }>;
}
export default EnhanceProductRelationsMigration;
//# sourceMappingURL=2026-01-16-enhance-product-relations.d.ts.map