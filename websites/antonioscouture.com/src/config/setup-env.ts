import dotenv from 'dotenv';
import * as path from 'path';

// NODE_ENV must be set before this file runs (e.g. cross-env NODE_ENV=production for start:prod).
// Do not default to 'development' here so that production stays production if set by the process.
const nodeEnv = process.env.NODE_ENV || 'development';

// Project root: from dist we have dist/src/config (3 levels up), from src we have src/config (2 levels up)
const isCompiled = __dirname.includes(path.sep + 'dist' + path.sep) || __dirname.endsWith(path.sep + 'dist');
const projectRoot = isCompiled
  ? path.resolve(__dirname, '..', '..', '..')
  : path.resolve(__dirname, '..', '..');
const cwdRoot = process.cwd();

// Load base .env first (if any), then env-specific file with override so .env.production / .env.development wins
dotenv.config({ path: path.resolve(projectRoot, '.env') });
dotenv.config({ path: path.resolve(cwdRoot, '.env') });
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(projectRoot, envFile);
console.log(`[env] Loading environment: ${nodeEnv} from ${envFile}`);
dotenv.config({ path: envPath, override: true });
dotenv.config({ path: path.resolve(cwdRoot, envFile), override: true });
