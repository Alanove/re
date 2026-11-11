import * as mysql from 'mysql2/promise';
import { dbConfig } from './database.config';

class Database {
  private static instance: Database;
  private pool: mysql.Pool | null = null;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPool(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool(dbConfig);
      console.log('✅ MySQL connection pool created');
    }
    return this.pool;
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    try {
      const pool = this.getPool();
      const connection = await pool.getConnection();
      return connection;
    } catch (err) {
      console.error('Failed to get connection from pool:', err);
      throw err;
    }
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<[T[], mysql.FieldPacket[]]> {
    const pool = this.getPool();
    return pool.query<any>(sql, params) as Promise<[T[], mysql.FieldPacket[]]>;
  }

  public async execute<T = any>(sql: string, params?: any[]): Promise<[T[], mysql.FieldPacket[]]> {
    const pool = this.getPool();
    return pool.execute<any>(sql, params) as Promise<[T[], mysql.FieldPacket[]]>;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      await connection.ping();
      connection.release();
      console.log('✅ Connected to MySQL database');
      return true;
    } catch (err) {
      console.error('❌ Failed to connect to database:', err);
      return false;
    }
  }
}

export const db = Database.getInstance();
export default db;
