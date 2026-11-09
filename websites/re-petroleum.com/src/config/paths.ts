import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findProjectRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    if (existsSync(path.join(current, 'transform.config.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`transform.config.json not found above ${startDir}`);
    }
    current = parent;
  }
}

export const PROJECT_ROOT = findProjectRoot(path.dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  root: PROJECT_ROOT,
  data: path.join(PROJECT_ROOT, 'data'),
  views: path.join(PROJECT_ROOT, 'views'),
  adminViews: path.join(PROJECT_ROOT, 'admin', 'views'),
  public: path.join(PROJECT_ROOT, 'public'),
  adminPublic: path.join(PROJECT_ROOT, 'admin', 'public'),
  uploads: path.join(PROJECT_ROOT, 'public', 'uploads'),
  transformConfig: path.join(PROJECT_ROOT, 'transform.config.json')
} as const;

export const DATA_FILES = {
  pages: path.join(PATHS.data, 'pages.json'),
  pageImages: path.join(PATHS.data, 'page-images.json'),
  menus: path.join(PATHS.data, 'menus.json'),
  home: path.join(PATHS.data, 'home.json'),
  offices: path.join(PATHS.data, 'offices.json'),
  settings: path.join(PATHS.data, 'settings.json'),
  users: path.join(PATHS.data, 'users.json'),
  submissions: path.join(PATHS.data, 'submissions.json'),
  assetManifest: path.join(PATHS.data, 'asset-manifest.json')
} as const;
