import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

function getProjectRoot(): string {
  return path.resolve(__dirname, '../..');
}

/**
 * Parse --env=development|production from argv and load the matching .env file
 * before any database modules are imported.
 */
export function bootstrapMigrationEnv(argv: string[] = process.argv): string {
  const envArg = argv.find((arg) => arg.startsWith('--env='));
  const nodeEnv = envArg?.split('=')[1] || process.env.NODE_ENV || 'development';
  process.env.NODE_ENV = nodeEnv;

  const projectRoot = getProjectRoot();
  const envFile = path.join(projectRoot, `.env.${nodeEnv}`);
  const fallbackFile = path.join(projectRoot, '.env');

  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  } else if (fs.existsSync(fallbackFile)) {
    dotenv.config({ path: fallbackFile });
  } else {
    console.warn(`[migrate] No env file found (tried ${envFile} and ${fallbackFile})`);
  }

  return nodeEnv;
}
