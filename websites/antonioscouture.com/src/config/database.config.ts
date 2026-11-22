import dotenv from 'dotenv';
import * as path from 'path';
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

// Migrations import this module before their own dotenv.config() body runs (imports are
// evaluated first). Load env files here when DB_NAME is still missing.
if (!(process.env.DB_NAME || '').trim()) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`), override: true });
}

function requireDbName(): string {
  const name = (process.env.DB_NAME || '').trim();
  if (!name) {
    throw new Error('DB_NAME is required. Set it in .env / .env.development / .env.production.');
  }
  return name;
}

// Read all database configuration from environment variables
export const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: requireDbName(),
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true' || process.env.DB_WAIT_FOR_CONNECTIONS === undefined,
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 10,
  queueLimit: process.env.DB_QUEUE_LIMIT ? parseInt(process.env.DB_QUEUE_LIMIT, 10) : 0
};

export default dbConfig;
