import * as mysql from 'mysql2/promise';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections?: boolean;
  connectionLimit?: number;
  queueLimit?: number;
  connectTimeout?: number;
  enableKeepAlive?: boolean;
}

const environment = process.env.NODE_ENV || 'development';

const configs: { [key: string]: DatabaseConfig } = {
  development: {
    // Prefer 127.0.0.1 over localhost on Windows (avoids intermittent IPv6 ETIMEDOUT)
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'P@55w0rd',
    database: process.env.DB_NAME || 'smb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true
  },
  production: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'P@55w0rd',
    database: process.env.DB_NAME || 'smb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true
  }
};

export const dbConfig: DatabaseConfig = configs[environment];

export default dbConfig;
