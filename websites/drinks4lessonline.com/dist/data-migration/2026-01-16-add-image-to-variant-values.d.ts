declare class AddImageToVariantValuesMigration {
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
export default AddImageToVariantValuesMigration;
//# sourceMappingURL=2026-01-16-add-image-to-variant-values.d.ts.map