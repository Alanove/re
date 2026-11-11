import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

/**
 * Load environment variables from `.env.development` or `.env.production`
 * based on NODE_ENV (falls back to `.env` if the named file is missing).
 */
function getProjectRoot(): string {
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../..');
  }
  return path.resolve(__dirname, '..');
}

const projectRoot = getProjectRoot();
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = path.join(projectRoot, `.env.${nodeEnv}`);
const fallbackFile = path.join(projectRoot, '.env');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else if (fs.existsSync(fallbackFile)) {
  dotenv.config({ path: fallbackFile });
} else {
  console.warn(`[loadEnv] No env file found (tried ${envFile} and ${fallbackFile})`);
}
