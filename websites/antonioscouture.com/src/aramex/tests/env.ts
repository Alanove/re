/**
 * Load .env before importing aramex client (so getClientInfo() can read process.env).
 */
import * as path from 'path';
import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
