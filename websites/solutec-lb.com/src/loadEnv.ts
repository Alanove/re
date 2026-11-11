import * as fs from 'fs';
import * as path from 'path';

function getProjectRoot(): string {
  if (__dirname.includes('dist')) {
    return path.resolve(__dirname, '../../');
  }
  return path.resolve(__dirname, '../');
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const root = getProjectRoot();
const isCompiledBuild = __dirname.includes('dist');
// npm run start runs compiled output; treat that as production unless NODE_ENV=development.
const useProductionEnv =
  process.env.NODE_ENV === 'production' ||
  (isCompiledBuild && process.env.NODE_ENV !== 'development');

const files = useProductionEnv
  ? ['.env.production', '.env']
  : ['.env', '.env.development', '.env.local'];

for (const file of files) {
  loadEnvFile(path.join(root, file));
}

if (useProductionEnv && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production';
}
