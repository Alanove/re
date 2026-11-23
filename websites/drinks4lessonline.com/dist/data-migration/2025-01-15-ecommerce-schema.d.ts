interface MigrationResult {
    success: boolean;
    message: string;
    error?: string;
}
declare class EcommerceSchemaMigration {
    private connection;
    up(): Promise<MigrationResult>;
    down(): Promise<MigrationResult>;
    private createProductCategoriesTable;
    private createSizeChartsTable;
    private createProductsTable;
    private createProductVariantsTable;
    private createProductImagesTable;
    private createProductReviewsTable;
    private createCustomerAddressesTable;
    private createWishlistsTable;
    private createShoppingCartsTable;
    private createCartItemsTable;
    private createOrdersTable;
    private createOrderItemsTable;
    private createOrderStatusHistoryTable;
    private createDiscountsTable;
    private createDiscountUsageTable;
    private createShippingZonesTable;
    private createShippingRatesTable;
    private createPaymentMethodsTable;
    private createTransactionsTable;
    private createUserOAuthTable;
    private createVariantTypesTable;
    private createVariantTypeValuesTable;
    private addHasImageToVariants;
}
export default EcommerceSchemaMigration;
//# sourceMappingURL=2025-01-15-ecommerce-schema.d.ts.map