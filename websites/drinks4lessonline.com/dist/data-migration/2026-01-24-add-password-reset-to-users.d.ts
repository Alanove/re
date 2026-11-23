declare class AddPasswordResetToUsersMigration {
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
export default AddPasswordResetToUsersMigration;
//# sourceMappingURL=2026-01-24-add-password-reset-to-users.d.ts.map