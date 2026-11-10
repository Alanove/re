import { redirectsRepository } from '../repositories/redirectsRepository.js';

function normalize(path: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  const trimmed = decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded;
  return trimmed.toLowerCase();
}

export class RedirectService {
  private cache: { source: unknown; map: Map<string, string> } | null = null;

  public async resolve(path: string): Promise<string | null> {
    const redirects = await redirectsRepository.findAll();
    if (!this.cache || this.cache.source !== redirects) {
      this.cache = { source: redirects, map: new Map(redirects.map((item) => [normalize(item.from), item.to])) };
    }
    const target = this.cache.map.get(normalize(path));
    return target && normalize(target) !== normalize(path) ? target : null;
  }
}

export const redirectService = new RedirectService();
