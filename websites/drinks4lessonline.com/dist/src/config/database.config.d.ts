export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    waitForConnections?: boolean;
    connectionLimit?: number;
    queueLimit?: number;
}
export declare const dbConfig: DatabaseConfig;
export default dbConfig;
//# sourceMappingURL=database.config.d.ts.map