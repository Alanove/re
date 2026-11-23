declare class CreateBrandsTableMigration {
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
export default CreateBrandsTableMigration;
//# sourceMappingURL=2026-01-08-create-brands-table.d.ts.map