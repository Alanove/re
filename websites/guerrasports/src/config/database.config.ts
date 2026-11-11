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
}

// Read all database configuration from environment variables
export const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'povdorie-beirut',
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true' || process.env.DB_WAIT_FOR_CONNECTIONS === undefined,
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 10,
  queueLimit: process.env.DB_QUEUE_LIMIT ? parseInt(process.env.DB_QUEUE_LIMIT, 10) : 0
};

export default dbConfig;
