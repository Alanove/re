import type { CollectionKind, TextDirection } from '../domain/models.js';
import { pagesService, type PageNode } from './pagesService.js';
import { excerpt, toPlainText } from './sanitizeService.js';

export const COLLECTION_PAGE_SIZE = 9;
const WORDS_PER_MINUTE = 200;

export interface EntryCard {
  id: number;
  title: string;
  url: string;
  summary: string;
  image: string;
  direction: TextDirection;
  date: string;
  dateLabel: string;
  day: string;
  month: string;
  year: string;
  weekday: string;
  venue: string;
  linkUrl: string;
  linkLabel: string;
  upcoming: boolean;
  readingMinutes: number;
}

export interface CollectionListing {
  root: PageNode;
  kind: CollectionKind;
  upcoming: EntryCard[];
  entries: EntryCard[];
  page: number;
  totalPages: number;
  total: number;
}

const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const yearFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function entryDate(page: PageNode, kind: CollectionKind): string {
  return kind === 'events' && page.eventDate ? `${page.eventDate}T00:00:00.000Z` : page.createdAt;
}

export function isUpcoming(page: PageNode): boolean {
  return page.eventDate !== '' && page.eventDate >= today();
}

export function toEntryCard(page: PageNode, kind: CollectionKind): EntryCard {
  const date = entryDate(page, kind);
  const when = new Date(date);
  const words = toPlainText(page.content).split(/\s+/).filter(Boolean).length;
  return {
    id: page.id,
    title: page.title,
    url: page.url,
    summary: (page.summary || excerpt(page.content, 240)).replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim(),
    image: page.heroImage,
    direction: page.direction,
    date,
    dateLabel: longDate.format(when),
    day: dayFormat.format(when),
    month: monthFormat.format(when),
    year: yearFormat.format(when),
    weekday: weekdayFormat.format(when),
    venue: page.venue,
    linkUrl: page.linkUrl,
    linkLabel: page.linkLabel,
    upcoming: kind === 'events' && isUpcoming(page),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  };
}

function newestFirst(kind: CollectionKind): (a: PageNode, b: PageNode) => number {
  return (a, b) => entryDate(b, kind).localeCompare(entryDate(a, kind)) || b.id - a.id;
}

function soonestFirst(a: PageNode, b: PageNode): number {
  return a.eventDate.localeCompare(b.eventDate) || a.id - b.id;
}

export class CollectionService {
  public async findRoot(kind: CollectionKind): Promise<PageNode | null> {
    return pagesService.findPublishedByKind(kind);
  }

  public isEntryOf(root: PageNode, page: PageNode): boolean {
    return page.parentId === root.id;
  }

  /** Upcoming events are always listed in full above the paginated archive. */
  public listing(root: PageNode, kind: CollectionKind, requestedPage: number): CollectionListing | null {
    const upcoming = kind === 'events' ? root.children.filter(isUpcoming).sort(soonestFirst) : [];
    const upcomingIds = new Set(upcoming.map((page) => page.id));
    const archive = root.children.filter((page) => !upcomingIds.has(page.id)).sort(newestFirst(kind));
    const totalPages = Math.max(1, Math.ceil(archive.length / COLLECTION_PAGE_SIZE));
    if (requestedPage > totalPages) {
      return null;
    }
    const start = (requestedPage - 1) * COLLECTION_PAGE_SIZE;
    return {
      root,
      kind,
      upcoming: requestedPage === 1 ? upcoming.map((page) => toEntryCard(page, kind)) : [],
      entries: archive.slice(start, start + COLLECTION_PAGE_SIZE).map((page) => toEntryCard(page, kind)),
      page: requestedPage,
      totalPages,
      total: root.children.length
    };
  }

  /**
   * Home page list: upcoming events soonest first, topped up with the most recent past ones.
   * With `pastOnly` the upcoming events are left out because the home page lists them in their own section.
   */
  public async latest(kind: CollectionKind, limit: number, pastOnly = false): Promise<{ root: PageNode | null; entries: EntryCard[]; hasUpcoming: boolean }> {
    const root = await this.findRoot(kind);
    if (!root) {
      return { root: null, entries: [], hasUpcoming: false };
    }
    const upcoming = kind === 'events' ? root.children.filter(isUpcoming).sort(soonestFirst) : [];
    const upcomingIds = new Set(upcoming.map((page) => page.id));
    const rest = root.children.filter((page) => !upcomingIds.has(page.id)).sort(newestFirst(kind));
    const shown = pastOnly ? rest : [...upcoming, ...rest];
    return {
      root,
      entries: shown.slice(0, limit).map((page) => toEntryCard(page, kind)),
      hasUpcoming: !pastOnly && upcoming.length > 0
    };
  }

  /** Events dated today or later, soonest first. Each one moves to the past list the day after its date. */
  public async upcoming(limit: number): Promise<{ root: PageNode | null; entries: EntryCard[]; total: number }> {
    const root = await this.findRoot('events');
    if (!root) {
      return { root: null, entries: [], total: 0 };
    }
    const upcoming = root.children.filter(isUpcoming).sort(soonestFirst);
    return { root, entries: upcoming.slice(0, limit).map((page) => toEntryCard(page, 'events')), total: upcoming.length };
  }

  public neighbours(root: PageNode, kind: CollectionKind, entry: PageNode): { newer: EntryCard | null; older: EntryCard | null; related: EntryCard[] } {
    const sorted = [...root.children].sort(newestFirst(kind));
    const index = sorted.findIndex((node) => node.id === entry.id);
    const newer = index > 0 ? sorted[index - 1] : undefined;
    const older = index >= 0 ? sorted[index + 1] : undefined;
    return {
      newer: newer ? toEntryCard(newer, kind) : null,
      older: older ? toEntryCard(older, kind) : null,
      related: sorted.filter((node) => node.id !== entry.id).slice(0, 3).map((page) => toEntryCard(page, kind))
    };
  }
}

export const collectionService = new CollectionService();
