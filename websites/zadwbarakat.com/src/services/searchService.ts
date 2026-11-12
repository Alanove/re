import MiniSearch, { type SearchResult } from 'minisearch';
import { thumbUrl } from '../domain/media.js';
import type { Article, Section } from '../domain/models.js';
import { SEARCH_TYPE_LABELS, searchTypes, type SearchType } from '../domain/search.js';
import { expandTerm, normalizeForSearch, queryTerm, tokenize } from '../lib/arabicNormalize.js';
import { articlesRepository } from '../repositories/articlesRepository.js';
import { albumsRepository, booksRepository, hymnsRepository, sectionsRepository, videosRepository } from '../repositories/contentRepositories.js';
import { articleUrl, effectiveDirection } from './articlesService.js';
import { contentEvents, type ContentChange } from './contentEvents.js';
import { formatDate, paginate, type Pagination } from './format.js';
import { pagesService } from './pagesService.js';
import { toPlainText } from './sanitizeService.js';

export const SEARCH_PAGE_SIZE = 20;
const BODY_LIMIT = 40_000;
const SNIPPET_WORDS = 42;
const INDEX_CHUNK_SIZE = 25;

interface IndexedFields {
  id: string;
  title: string;
  summary: string;
  tags: string;
  body: string;
}

interface DocInfo {
  type: SearchType;
  refId: number;
  title: string;
  summary: string;
  body: string;
  url: string;
  image: string;
  sectionId: number | null;
  sectionTitle: string;
  date: string;
  direction: 'rtl' | 'ltr';
}

export interface SearchHit {
  type: SearchType;
  typeLabel: string;
  title: string;
  titleHtml: string;
  snippetHtml: string;
  url: string;
  image: string;
  sectionTitle: string;
  date: string;
  direction: 'rtl' | 'ltr';
}

export interface SearchFacet<K> {
  key: K;
  label: string;
  count: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  hits: SearchHit[];
  pagination: Pagination;
  types: SearchFacet<SearchType>[];
  sections: SearchFacet<number>[];
  matchedAll: boolean;
}

export interface SearchRequest {
  q: string;
  type: SearchType | null;
  sectionId: number | null;
  page: number;
}

export interface Suggestion {
  title: string;
  url: string;
  type: SearchType;
  typeLabel: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function docId(type: SearchType, refId: number): string {
  return `${type}:${refId}`;
}

function queryStems(query: string): string[] {
  return [...new Set(tokenize(query).map(queryTerm).filter((term): term is string => Boolean(term)))];
}

function wordMatches(word: string, stems: readonly string[]): boolean {
  const folded = normalizeForSearch(word.replace(/[^\p{L}\p{M}\p{N}]+/gu, ''));
  return folded.length > 0 && stems.some((stem) => folded.includes(stem));
}

function highlightWords(words: readonly string[], stems: readonly string[]): string {
  return words.map((word) => (wordMatches(word, stems) ? `<mark>${escapeHtml(word)}</mark>` : escapeHtml(word))).join(' ');
}

function snippet(text: string, stems: readonly string[]): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const first = words.findIndex((word) => wordMatches(word, stems));
  const start = first <= 12 ? 0 : first - 12;
  const slice = words.slice(start, start + SNIPPET_WORDS);
  return `${start > 0 ? '… ' : ''}${highlightWords(slice, stems)}${start + SNIPPET_WORDS < words.length ? ' …' : ''}`;
}

function createIndex(): MiniSearch<IndexedFields> {
  return new MiniSearch<IndexedFields>({
    idField: 'id',
    fields: ['title', 'summary', 'tags', 'body'],
    storeFields: [],
    tokenize,
    processTerm: (term) => expandTerm(term),
    searchOptions: {
      boost: { title: 4, summary: 2, tags: 2, body: 1 },
      processTerm: (term) => queryTerm(term),
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => (term.length >= 4 ? 0.15 : false),
      maxFuzzy: 2,
      weights: { fuzzy: 0.4, prefix: 0.5 }
    }
  });
}

/**
 * In-memory full-text index over every public record. Built on first use (and warmed at boot),
 * then kept current from `contentEvents`: saved articles are re-indexed one by one, other kinds
 * mark their type stale and are rebuilt on the next query.
 */
export class SearchService {
  private index = createIndex();
  private docs = new Map<string, DocInfo>();
  private building: Promise<void> | null = null;
  private updating: Promise<void> | null = null;
  private ready = false;
  private stale = new Set<SearchType>();
  private pendingArticles = new Set<number>();

  constructor() {
    contentEvents.on('changed', (change) => {
      this.onChange(change);
    });
  }

  public async warm(): Promise<void> {
    await this.ensure();
  }

  public async search(request: SearchRequest): Promise<SearchResponse> {
    const query = request.q.trim();
    const stems = queryStems(query);
    const empty: SearchResponse = {
      query,
      total: 0,
      hits: [],
      pagination: { page: 1, totalPages: 1, total: 0, pageSize: SEARCH_PAGE_SIZE },
      types: [],
      sections: [],
      matchedAll: true
    };
    if (stems.length === 0) {
      return empty;
    }
    await this.ensure();
    let matchedAll = true;
    let results = this.index.search(query, { combineWith: 'AND' });
    if (results.length === 0 && stems.length > 1) {
      matchedAll = false;
      results = this.index.search(query, { combineWith: 'OR' });
    }
    const all = results.map((result) => ({ result, doc: this.docs.get(String(result.id)) })).filter((entry): entry is { result: SearchResult; doc: DocInfo } => entry.doc !== undefined);

    const typeCounts = new Map<SearchType, number>();
    const sectionCounts = new Map<number, { label: string; count: number }>();
    for (const { doc } of all) {
      typeCounts.set(doc.type, (typeCounts.get(doc.type) ?? 0) + 1);
      if (doc.sectionId !== null && (request.type === null || request.type === 'article')) {
        const current = sectionCounts.get(doc.sectionId) ?? { label: doc.sectionTitle, count: 0 };
        current.count += 1;
        sectionCounts.set(doc.sectionId, current);
      }
    }
    const filtered = all.filter(({ doc }) => (request.type === null || doc.type === request.type) && (request.sectionId === null || doc.sectionId === request.sectionId));
    const page = paginate(filtered, request.page, SEARCH_PAGE_SIZE) ?? paginate(filtered, 1, SEARCH_PAGE_SIZE);
    return {
      query,
      total: filtered.length,
      hits: (page?.slice ?? []).map(({ doc }) => ({
        type: doc.type,
        typeLabel: SEARCH_TYPE_LABELS[doc.type],
        title: doc.title,
        titleHtml: highlightWords(doc.title.split(/\s+/), stems),
        snippetHtml: snippet(doc.body || doc.summary, stems) || escapeHtml(doc.summary),
        url: doc.url,
        image: doc.image,
        sectionTitle: doc.sectionTitle,
        date: doc.date,
        direction: doc.direction
      })),
      pagination: page?.pagination ?? empty.pagination,
      types: searchTypes.filter((type) => typeCounts.has(type)).map((type) => ({ key: type, label: SEARCH_TYPE_LABELS[type], count: typeCounts.get(type) ?? 0 })),
      sections: [...sectionCounts.entries()].map(([key, value]) => ({ key, label: value.label, count: value.count })).sort((a, b) => b.count - a.count),
      matchedAll
    };
  }

  /** Up to `limit` quick results for the header search box. */
  public async suggest(q: string, limit = 6): Promise<Suggestion[]> {
    if (queryStems(q).length === 0) {
      return [];
    }
    await this.ensure();
    return this.index
      .search(q, { combineWith: 'AND' })
      .slice(0, limit)
      .map((result) => this.docs.get(String(result.id)))
      .filter((doc): doc is DocInfo => doc !== undefined)
      .map((doc) => ({ title: doc.title, url: doc.url, type: doc.type, typeLabel: SEARCH_TYPE_LABELS[doc.type] }));
  }

  /** Record ids of one type ranked by relevance; used by the library and hymn filters. */
  public async rankedIds(type: SearchType, q: string): Promise<number[]> {
    if (queryStems(q).length === 0) {
      return [];
    }
    await this.ensure();
    return this.index
      .search(q, { combineWith: 'AND', filter: (result) => String(result.id).startsWith(`${type}:`) })
      .map((result) => this.docs.get(String(result.id))?.refId)
      .filter((id): id is number => id !== undefined);
  }

  /** Articles most similar to the given one (shared title words, same section preferred). */
  public async relatedArticleIds(article: Article): Promise<number[]> {
    const terms = queryStems(`${article.title} ${article.tags.join(' ')}`).filter((term) => term.length >= 3);
    if (terms.length === 0) {
      return [];
    }
    await this.ensure();
    const self = docId('article', article.id);
    return this.index
      .search(terms.join(' '), {
        combineWith: 'OR',
        fuzzy: false,
        prefix: false,
        fields: ['title', 'tags', 'summary'],
        filter: (result) => String(result.id).startsWith('article:') && String(result.id) !== self,
        boostDocument: (id) => (this.docs.get(String(id))?.sectionId === article.sectionId ? 1.3 : 1)
      })
      .slice(0, 6)
      .map((result) => this.docs.get(String(result.id))?.refId)
      .filter((id): id is number => id !== undefined);
  }

  private onChange(change: ContentChange): void {
    switch (change.kind) {
      case 'article':
        if (change.id === null) {
          this.stale.add('article');
        } else {
          this.pendingArticles.add(change.id);
        }
        break;
      case 'section':
        this.stale.add('article');
        break;
      case 'book':
        this.stale.add('book');
        break;
      case 'hymn':
        this.stale.add('hymn');
        break;
      case 'album':
        this.stale.add('album');
        break;
      case 'video':
        this.stale.add('video');
        break;
      case 'page':
        for (const type of ['page', 'book', 'hymn', 'album', 'video'] as const) {
          this.stale.add(type);
        }
        break;
      default:
        break;
    }
  }

  private async ensure(): Promise<void> {
    if (!this.ready) {
      this.building ??= this.buildAll().finally(() => {
        this.building = null;
      });
      await this.building;
      return;
    }
    while (this.updating) {
      await this.updating;
    }
    if (this.stale.size > 0 || this.pendingArticles.size > 0) {
      this.updating = this.applyChanges().finally(() => {
        this.updating = null;
      });
      await this.updating;
    }
  }

  private async applyChanges(): Promise<void> {
    if (this.stale.size > 0) {
      const types = [...this.stale];
      this.stale.clear();
      for (const type of types) {
        await this.rebuildType(type);
      }
      if (types.includes('article')) {
        this.pendingArticles.clear();
      }
    }
    if (this.pendingArticles.size > 0) {
      const ids = [...this.pendingArticles];
      this.pendingArticles.clear();
      await this.refreshArticles(ids);
    }
  }

  private async buildAll(): Promise<void> {
    const started = Date.now();
    this.index = createIndex();
    this.docs.clear();
    this.stale.clear();
    this.pendingArticles.clear();
    for (const type of searchTypes) {
      await this.addInChunks(await this.collect(type));
    }
    this.ready = true;
    console.info(`Search index built: ${this.docs.size} documents in ${Date.now() - started} ms`);
  }

  private async rebuildType(type: SearchType): Promise<void> {
    for (const [id, doc] of this.docs) {
      if (doc.type === type) {
        this.index.discard(id);
        this.docs.delete(id);
      }
    }
    await this.addInChunks(await this.collect(type));
  }

  private async refreshArticles(ids: number[]): Promise<void> {
    const sections = new Map((await sectionsRepository.findAll()).map((section) => [section.id, section]));
    for (const id of ids) {
      const key = docId('article', id);
      if (this.docs.has(key)) {
        this.index.discard(key);
        this.docs.delete(key);
      }
      const article = await articlesRepository.findById(id);
      const section = article ? sections.get(article.sectionId) : undefined;
      if (article && section) {
        this.add(this.articleDocs([article], sections));
      }
    }
  }

  private add(entries: { fields: IndexedFields; info: DocInfo }[]): void {
    for (const entry of entries) {
      this.docs.set(entry.fields.id, entry.info);
    }
    this.index.addAll(entries.map((entry) => entry.fields));
  }

  /** Bulk indexing in small chunks so pages keep being served while thousands of articles are indexed. */
  private async addInChunks(entries: { fields: IndexedFields; info: DocInfo }[]): Promise<void> {
    for (const entry of entries) {
      this.docs.set(entry.fields.id, entry.info);
    }
    await this.index.addAllAsync(
      entries.map((entry) => entry.fields),
      { chunkSize: INDEX_CHUNK_SIZE }
    );
  }

  private articleDocs(articles: readonly Article[], sections: Map<number, Section>): { fields: IndexedFields; info: DocInfo }[] {
    const entries: { fields: IndexedFields; info: DocInfo }[] = [];
    for (const article of articles) {
      const section = sections.get(article.sectionId);
      if (!section || article.status !== 'published' || section.status !== 'published') {
        continue;
      }
      const body = toPlainText(article.content).slice(0, BODY_LIMIT);
      const direction = effectiveDirection(article.direction, `${article.title} ${body.slice(0, 2000)}`);
      const id = docId('article', article.id);
      entries.push({
        fields: { id, title: article.title, summary: article.summary, tags: `${article.tags.join(' ')} ${section.title}`, body },
        info: {
          type: 'article',
          refId: article.id,
          title: article.title,
          summary: article.summary,
          body,
          url: articleUrl(article, section),
          image: article.image ? thumbUrl(article.image.src) : '',
          sectionId: section.id,
          sectionTitle: section.title,
          date: article.dateKnown ? formatDate(article.publishedAt, direction) : '',
          direction
        }
      });
    }
    return entries;
  }

  private async collect(type: SearchType): Promise<{ fields: IndexedFields; info: DocInfo }[]> {
    switch (type) {
      case 'article': {
        const sections = new Map((await sectionsRepository.findAll()).map((section) => [section.id, section]));
        return this.articleDocs(await articlesRepository.snapshot(), sections);
      }
      case 'book': {
        const page = await pagesService.findPublishedByKind('library');
        if (!page) {
          return [];
        }
        return (await booksRepository.findAll())
          .filter((book) => book.active)
          .map((book) => {
            const summary = [book.author, book.publisher, book.year].filter(Boolean).join(' · ');
            return {
              fields: { id: docId('book', book.id), title: book.title, summary: book.author, tags: `${book.genre} ${book.subject} ${book.language}`, body: `${book.publisher} ${book.notes}` },
              info: {
                type: 'book' as const,
                refId: book.id,
                title: book.title,
                summary,
                body: [summary, book.genre, book.notes].filter(Boolean).join(' · '),
                url: `${page.url}?q=${encodeURIComponent(book.title)}`,
                image: '',
                sectionId: null,
                sectionTitle: page.title,
                date: '',
                direction: effectiveDirection('auto', book.title)
              }
            };
          });
      }
      case 'hymn': {
        const page = await pagesService.findPublishedByKind('hymns');
        if (!page) {
          return [];
        }
        return (await hymnsRepository.findAll())
          .filter((hymn) => hymn.active)
          .map((hymn) => {
            const summary = [hymn.singer, hymn.album].filter(Boolean).join(' · ');
            return {
              fields: { id: docId('hymn', hymn.id), title: hymn.title, summary: hymn.singer, tags: `${hymn.category} ${hymn.album}`, body: hymn.author },
              info: {
                type: 'hymn' as const,
                refId: hymn.id,
                title: hymn.title,
                summary,
                body: [summary, hymn.author, hymn.category].filter(Boolean).join(' · '),
                url: `${page.url}?q=${encodeURIComponent(hymn.title)}#hymn-${hymn.id}`,
                image: '',
                sectionId: null,
                sectionTitle: page.title,
                date: '',
                direction: 'rtl' as const
              }
            };
          });
      }
      case 'album': {
        const page = await pagesService.findPublishedByKind('albums');
        if (!page) {
          return [];
        }
        return (await albumsRepository.findAll())
          .filter((album) => album.status === 'published')
          .map((album) => {
            const captions = album.images.map((image) => image.caption).filter(Boolean).join(' ');
            return {
              fields: { id: docId('album', album.id), title: album.title, summary: album.summary, tags: '', body: captions },
              info: {
                type: 'album' as const,
                refId: album.id,
                title: album.title,
                summary: album.summary,
                body: `${album.summary} ${captions}`.trim(),
                url: `${page.url}/${album.slug}`,
                image: album.images[0] ? thumbUrl(album.images[0].src) : '',
                sectionId: null,
                sectionTitle: page.title,
                date: album.dateKnown ? formatDate(album.publishedAt) : '',
                direction: 'rtl' as const
              }
            };
          });
      }
      case 'video': {
        const page = await pagesService.findPublishedByKind('videos');
        if (!page) {
          return [];
        }
        return (await videosRepository.findAll())
          .filter((video) => video.status === 'published')
          .map((video) => ({
            fields: { id: docId('video', video.id), title: video.title, summary: video.summary, tags: '', body: '' },
            info: {
              type: 'video' as const,
              refId: video.id,
              title: video.title,
              summary: video.summary,
              body: video.summary,
              url: `${page.url}/${video.slug}`,
              image: video.image ? thumbUrl(video.image.src) : `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
              sectionId: null,
              sectionTitle: page.title,
              date: video.dateKnown ? formatDate(video.publishedAt) : '',
              direction: effectiveDirection(video.direction, video.title)
            }
          }));
      }
      case 'page': {
        const pages = await pagesService.getPublishedFlat();
        return pages
          .filter((page) => page.kind === 'page' || page.kind === 'contact' || page.content.trim() !== '')
          .map((page) => {
            const body = toPlainText(page.content).slice(0, BODY_LIMIT);
            return {
              fields: { id: docId('page', page.id), title: page.title, summary: page.summary, tags: page.header, body },
              info: {
                type: 'page' as const,
                refId: page.id,
                title: page.title,
                summary: page.summary,
                body,
                url: page.url,
                image: page.heroImage ? thumbUrl(page.heroImage) : '',
                sectionId: null,
                sectionTitle: page.ancestors[0]?.title ?? '',
                date: '',
                direction: effectiveDirection(page.direction, `${page.title} ${body.slice(0, 2000)}`)
              }
            };
          });
      }
    }
  }
}

export const searchService = new SearchService();
