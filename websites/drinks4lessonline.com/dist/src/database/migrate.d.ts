declare class DataMigration {
    private dataPath;
    private results;
    private readJSONFile;
    runSchema(): Promise<void>;
    migrateUsers(): Promise<void>;
    migrateAccounts(): Promise<void>;
    migrateTransactionCategories(): Promise<void>;
    migrateTransactions(): Promise<void>;
    migrateApartments(): Promise<void>;
    migratePayments(): Promise<void>;
    migrateApartmentPayments(): Promise<void>;
    migrateProjects(): Promise<void>;
    migratePages(): Promise<void>;
    migrateMenu(): Promise<void>;
    migrateAdminMenu(): Promise<void>;
    migrateSlider(): Promise<void>;
    migrateSiteSettings(): Promise<void>;
    migrateThemeConfig(): Promise<void>;
    run(): Promise<void>;
}
export default DataMigration;
//# sourceMappingURL=migrate.d.ts.map