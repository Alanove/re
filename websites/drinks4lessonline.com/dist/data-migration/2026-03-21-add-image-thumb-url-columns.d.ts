declare class AddImageThumbUrlColumnsMigration {
    private connection;
    connect(): Promise<void>;
    run(): Promise<{
        success: boolean;
        message: string;
        error?: string;
    }>;
}
export default AddImageThumbUrlColumnsMigration;
//# sourceMappingURL=2026-03-21-add-image-thumb-url-columns.d.ts.map