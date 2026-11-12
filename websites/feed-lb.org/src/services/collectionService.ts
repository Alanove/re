import { pagesService, type PageNode } from './pagesService.js';
import { excerpt, toPlainText } from './sanitizeService.js';

export const NEWS_PAGE_SIZE = 9;
const WORDS_PER_MINUTE = 200;

export interface StoryCard {
  id: number;
  title: string;
  url: string;
  summary: string;
  image: string;
  date: string;
  dateLabel: string;
  day: string;
  month: string;
  year: string;
  readingMinutes: number;
}

export interface NewsListing {
  root: PageNode;
  entries: StoryCard[];
  page: number;
  totalPages: number;
  total: number;
}

const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const yearFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' });

export function toStoryCard(page: PageNode): StoryCard {
  const when = new Date(page.createdAt);
  const words = toPlainText(page.content).split(/\s+/).filter(Boolean).length;
  return {
    id: page.id,
    title: page.title,
    url: page.url,
    summary: (page.summary || excerpt(page.content, 240)).replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim(),
    image: page.heroImage,
    date: page.createdAt,
    dateLabel: longDate.format(when),
    day: dayFormat.format(when),
    month: monthFormat.format(when),
    year: yearFormat.format(when),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  };
}

function newestFirst(a: PageNode, b: PageNode): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

export class CollectionService {
  public async findRoot(): Promise<PageNode | null> {
    return pagesService.findPublishedByKind('news');
  }

  public listing(root: PageNode, requestedPage: number): NewsListing | null {
    const sorted = [...root.children].sort(newestFirst);
    const totalPages = Math.max(1, Math.ceil(sorted.length / NEWS_PAGE_SIZE));
    if (requestedPage > totalPages) {
      return null;
    }
    const start = (requestedPage - 1) * NEWS_PAGE_SIZE;
    return {
      root,
      entries: sorted.slice(start, start + NEWS_PAGE_SIZE).map(toStoryCard),
      page: requestedPage,
      totalPages,
      total: sorted.length
    };
  }

  public async latest(limit: number): Promise<{ root: PageNode | null; entries: StoryCard[] }> {
    const root = await this.findRoot();
    if (!root) {
      return { root: null, entries: [] };
    }
    return { root, entries: [...root.children].sort(newestFirst).slice(0, limit).map(toStoryCard) };
  }

  public neighbours(root: PageNode, entry: PageNode): { newer: StoryCard | null; older: StoryCard | null; related: StoryCard[] } {
    const sorted = [...root.children].sort(newestFirst);
    const index = sorted.findIndex((node) => node.id === entry.id);
    const newer = index > 0 ? sorted[index - 1] : undefined;
    const older = index >= 0 ? sorted[index + 1] : undefined;
    return {
      newer: newer ? toStoryCard(newer) : null,
      older: older ? toStoryCard(older) : null,
      related: sorted.filter((node) => node.id !== entry.id).slice(0, 3).map(toStoryCard)
    };
  }
}

export const collectionService = new CollectionService();
