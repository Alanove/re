import * as mysql from 'mysql2/promise';
declare class Database {
    private static instance;
    private pool;
    private constructor();
    static getInstance(): Database;
    getPool(): mysql.Pool;
    getConnection(): Promise<mysql.PoolConnection>;
    query<T = any>(sql: string, params?: any[]): Promise<[T[], mysql.FieldPacket[]]>;
    execute<T = any>(sql: string, params?: any[]): Promise<[T[], mysql.FieldPacket[]]>;
    close(): Promise<void>;
    testConnection(): Promise<boolean>;
}
export declare const db: Database;
export default db;
//# sourceMappingURL=database.d.ts.map