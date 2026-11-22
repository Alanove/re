import * as mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import * as path from 'path';

async function testConnection() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = `.env.${nodeEnv}`;
  const envPath = path.resolve(process.cwd(), envFile);
  
  console.log(`Loading environment from: ${envPath}`);
  dotenv.config({ path: envPath });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const dbName = (process.env.DB_NAME || '').trim();
  if (!dbName) {
    throw new Error('DB_NAME is required. Set it in .env / .env.development / .env.production.');
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  };

  console.log('Connection Config:', { ...config, password: '****' });

  try {
    console.log('Attempting to connect...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Successfully connected to database!');
    await connection.end();
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();
