import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../../src/constants';

export type HomeSectionType = 'html' | 'categories';

export interface HomeSection {
  key: string;
  label: string;
  type: HomeSectionType;
  html: string;
  enabled: boolean;
  sourceOnly?: boolean;
  lastUpdated?: string;
}

export interface HomeSectionsData {
  wrapperStart: string;
  wrapperEnd: string;
  sections: HomeSection[];
}

export const CATEGORIES_PLACEHOLDER = '<!--SOLU_CATEGORIES-->';
export const NEWS_PLACEHOLDER = '<!--SOLU_NEWS-->';

export class HomeSectionsService {
  private static instance: HomeSectionsService;
  private dataPath: string;

  private constructor() {
    this.dataPath = DATA_PATHS.HOME_SECTIONS_FILE;
  }

  public static getInstance(): HomeSectionsService {
    if (!HomeSectionsService.instance) {
      HomeSectionsService.instance = new HomeSectionsService();
    }
    return HomeSectionsService.instance;
  }

  public exists(): boolean {
    return fs.existsSync(this.dataPath);
  }

  /**
   * Read fresh from disk on every call so edits show up without a restart.
   */
  public get(): HomeSectionsData | null {
    try {
      if (!this.exists()) return null;
      const parsed = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
      return {
        wrapperStart: parsed.wrapperStart || '',
        wrapperEnd: parsed.wrapperEnd || '',
        sections: Array.isArray(parsed.sections) ? parsed.sections : []
      };
    } catch (error) {
      console.error('Error loading home sections:', error);
      return null;
    }
  }

  public getSection(key: string): HomeSection | null {
    const data = this.get();
    return data?.sections.find((s) => s.key === key) || null;
  }

  public updateSection(key: string, updates: { html?: string; enabled?: boolean }): HomeSection | null {
    const data = this.get();
    if (!data) return null;
    const section = data.sections.find((s) => s.key === key);
    if (!section) return null;

    if (updates.html !== undefined) section.html = updates.html;
    if (updates.enabled !== undefined) section.enabled = updates.enabled;
    section.lastUpdated = new Date().toISOString();

    this.save(data);
    return section;
  }

  private save(data: HomeSectionsData): void {
    this.backup();
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8');
  }

  private backup(): void {
    if (!this.exists()) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(this.dataPath, `${this.dataPath}.${stamp}.bak`);
    this.pruneBackups(20);
  }

  private pruneBackups(keep: number): void {
    const dir = path.dirname(this.dataPath);
    const prefix = `${path.basename(this.dataPath)}.`;
    const backups = fs.readdirSync(dir)
      .filter((name) => name.startsWith(prefix) && name.endsWith('.bak'))
      .sort();
    backups.slice(0, Math.max(0, backups.length - keep)).forEach((name) => {
      fs.unlinkSync(path.join(dir, name));
    });
  }
}
