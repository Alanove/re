interface MigrationResult {
    success: boolean;
    message: string;
    error?: string;
}
declare class AddDiscountToCartMigration {
    private connection;
    up(): Promise<MigrationResult>;
    down(): Promise<MigrationResult>;
}
export default AddDiscountToCartMigration;
//# sourceMappingURL=2026-01-25-add-discount-to-cart.d.ts.map