interface MigrationResult {
    success: boolean;
    message: string;
    error?: string;
}
declare class AttributeValueImagesMigration {
    up(): Promise<MigrationResult>;
    down(): Promise<MigrationResult>;
}
export default AttributeValueImagesMigration;
//# sourceMappingURL=add-attribute-value-images.d.ts.map