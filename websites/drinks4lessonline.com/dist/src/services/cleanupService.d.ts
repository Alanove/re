export declare class CleanupService {
    private static instance;
    private intervalId;
    private readonly CLEANUP_INTERVAL_MS;
    private readonly GUEST_CART_DAYS;
    private readonly CUSTOMER_CART_DAYS;
    private readonly DATA_RETENTION_DAYS;
    private constructor();
    static getInstance(): CleanupService;
    start(): void;
    stop(): void;
    private runCleanup;
}
declare const _default: CleanupService;
export default _default;
//# sourceMappingURL=cleanupService.d.ts.map