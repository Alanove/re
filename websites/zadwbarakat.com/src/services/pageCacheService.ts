import { contentEvents } from './contentEvents.js';

const MAX_ENTRIES = 300;
const TTL_MS = 10 * 60_000;

/**
 * Rendered HTML for the busiest public pages (home, section listings). Any content change clears
 * everything, so editors never see stale pages; the TTL only bounds memory for rarely hit pages.
 */
export class PageCacheService {
  private readonly entries = new Map<string, { html: string; expires: number }>();

  constructor() {
    contentEvents.on('changed', () => {
      this.entries.clear();
    });
  }

  public get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expires < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.html;
  }

  public set(key: string, html: string): void {
    if (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, { html, expires: Date.now() + TTL_MS });
  }
}

export const pageCacheService = new PageCacheService();
