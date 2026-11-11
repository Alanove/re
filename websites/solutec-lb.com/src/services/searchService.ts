import pagesService from './pagesService';
import { NewsService } from '../../admin/services/newsService';

export interface SearchResult {
  title: string;
  url: string;
  excerpt: string;
  type: 'page' | 'news';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExcerpt(text: string, maxLen = 220): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen).replace(/\s+\S*$/, '');
  return `${trimmed}…`;
}

function buildSearchableText(parts: (string | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .join(' ')
    .toLowerCase();
}

function matchesQuery(searchable: string, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return false;
  return terms.every((term) => searchable.includes(term));
}

function findMatchExcerpt(searchablePlain: string, query: string, maxLen = 220): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const firstTerm = terms[0];
  if (!firstTerm) return getExcerpt(searchablePlain);

  const idx = searchablePlain.toLowerCase().indexOf(firstTerm);
  if (idx < 0) return getExcerpt(searchablePlain);

  const start = Math.max(0, idx - 80);
  const slice = searchablePlain.slice(start);
  const prefix = start > 0 ? '…' : '';
  return prefix + getExcerpt(slice, maxLen - prefix.length);
}

class SearchService {
  search(query: string): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results: SearchResult[] = [];
    const pagesData = pagesService.getPagesData();

    for (const page of Object.values(pagesData.pages)) {
      if (page.key === 'home') continue;
      if ((page as { status?: string }).status === 'draft') continue;

      const seo = page.seo || ({} as { pageTitle?: string; pageDescription?: string; pageKeywords?: string });
      const plainContent = stripHtml(page.content || '');
      const searchable = buildSearchableText([
        page.title,
        seo.pageTitle,
        seo.pageDescription,
        seo.pageKeywords,
        plainContent
      ]);

      if (!matchesQuery(searchable, trimmed)) continue;

      results.push({
        title: page.title,
        url: page.url,
        excerpt: findMatchExcerpt(plainContent, trimmed) || getExcerpt(plainContent),
        type: 'page'
      });
    }

    const newsService = NewsService.getInstance();
    for (const item of newsService.getPublishedNews()) {
      const seo = item.seo || ({} as { pageTitle?: string; pageDescription?: string; pageKeywords?: string });
      const plainContent = stripHtml(item.content || '');
      const searchable = buildSearchableText([
        item.title,
        seo.pageTitle,
        seo.pageDescription,
        seo.pageKeywords,
        plainContent
      ]);

      if (!matchesQuery(searchable, trimmed)) continue;

      const url = item.url || `/news/${item.key}`;
      results.push({
        title: item.title,
        url,
        excerpt: findMatchExcerpt(plainContent, trimmed) || getExcerpt(plainContent),
        type: 'news'
      });
    }

    results.sort((a, b) => a.title.localeCompare(b.title));
    return results;
  }
}

export default new SearchService();
