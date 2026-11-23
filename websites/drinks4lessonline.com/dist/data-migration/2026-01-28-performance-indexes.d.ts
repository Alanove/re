declare class PerformanceIndexesMigration {
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
export default PerformanceIndexesMigration;
//# sourceMappingURL=2026-01-28-performance-indexes.d.ts.map