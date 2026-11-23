declare class EnhanceVariantValuesMigration {
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
export default EnhanceVariantValuesMigration;
//# sourceMappingURL=2026-01-07-enhance-variant-values.d.ts.map