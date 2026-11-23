declare class EncryptCustomerAddressesMigration {
    up(): Promise<{
        success: boolean;
        message: any;
    }>;
    down(): Promise<{
        success: boolean;
        message: string;
    }>;
}
export default EncryptCustomerAddressesMigration;
//# sourceMappingURL=2026-01-25-encrypt-customer-addresses.d.ts.map