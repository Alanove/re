import type { Book } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { normalizeForSearch } from '../lib/arabicNormalize.js';
import { toCsv } from '../lib/csv.js';
import { booksRepository } from '../repositories/contentRepositories.js';
import { BOOK_CSV_COLUMNS, type BookCsvRow, type BookFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { paginate, type Pagination } from './format.js';
import { searchService } from './searchService.js';

export const LIBRARY_PAGE_SIZE = 30;

export interface LibraryQuery {
  q: string;
  genre: string;
  language: string;
  author: string;
  page: number;
}

export interface LibraryResult {
  books: Book[];
  pagination: Pagination;
  genres: { name: string; count: number }[];
  languages: { name: string; count: number }[];
}

function counts(values: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function byTitle(a: Book, b: Book): number {
  return a.title.localeCompare(b.title, 'ar');
}

export class LibraryService {
  /** Keyword matches are ranked by the search index; genre and language narrow them further. */
  public async browse(query: LibraryQuery): Promise<LibraryResult | null> {
    const active = (await booksRepository.findAll()).filter((book) => book.active);
    let books: Book[];
    if (query.q) {
      const byId = new Map(active.map((book) => [book.id, book]));
      books = (await searchService.rankedIds('book', query.q)).map((id) => byId.get(id)).filter((book): book is Book => book !== undefined);
    } else {
      books = [...active].sort(byTitle);
    }
    const genres = counts(books.map((book) => book.genre));
    const languages = counts(books.map((book) => book.language));
    const author = normalizeForSearch(query.author.trim());
    const filtered = books.filter(
      (book) =>
        (!query.genre || book.genre === query.genre) &&
        (!query.language || book.language === query.language) &&
        (!author || normalizeForSearch(book.author).includes(author))
    );
    const page = paginate(filtered, query.page, LIBRARY_PAGE_SIZE);
    if (!page) {
      return query.page === 1 ? { books: [], pagination: { page: 1, totalPages: 1, total: 0, pageSize: LIBRARY_PAGE_SIZE }, genres, languages } : null;
    }
    return { books: page.slice, pagination: page.pagination, genres, languages };
  }

  public async adminList(q: string, page: number, pageSize: number): Promise<{ rows: Book[]; pagination: Pagination }> {
    const needle = normalizeForSearch(q.trim());
    const all = (await booksRepository.findAll())
      .filter((book) => !needle || normalizeForSearch(`${book.title} ${book.author}`).includes(needle))
      .sort(byTitle);
    const result = paginate(all, page, pageSize) ?? paginate(all, 1, pageSize);
    return { rows: result?.slice ?? [], pagination: result?.pagination ?? { page: 1, totalPages: 1, total: 0, pageSize } };
  }

  public async genres(): Promise<string[]> {
    return counts((await booksRepository.findAll()).map((book) => book.genre)).map((entry) => entry.name);
  }

  public async getById(id: number): Promise<Book> {
    const book = await booksRepository.findById(id);
    if (!book) {
      throw new NotFoundError('Book not found.');
    }
    return book;
  }

  public async create(input: BookFormInput): Promise<Book> {
    const now = new Date().toISOString();
    const created = await booksRepository.insert({ legacyId: null, ...input, createdAt: now, updatedAt: now });
    contentEvents.changed('book', created.id);
    return created;
  }

  public async update(id: number, input: BookFormInput): Promise<Book> {
    const existing = await this.getById(id);
    const saved = await booksRepository.replace({ ...existing, ...input, updatedAt: new Date().toISOString() });
    contentEvents.changed('book', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    if (!(await booksRepository.remove(id))) {
      throw new NotFoundError('Book not found.');
    }
    contentEvents.changed('book', id);
  }

  public async exportCsv(): Promise<string> {
    const books = (await booksRepository.findAll()).sort((a, b) => a.id - b.id);
    return toCsv(
      BOOK_CSV_COLUMNS,
      books.map((book) => [
        String(book.id),
        book.title,
        book.author,
        book.publisher,
        book.language,
        book.genre,
        book.subject,
        book.format,
        book.year,
        book.pageCount === null ? '' : String(book.pageCount),
        book.notes,
        book.active ? 'yes' : 'no'
      ])
    );
  }

  /**
   * Applies a validated spreadsheet: rows with an id update that book, rows without one add a book. Books missing from
   * the file are left alone. Nothing is written when any id is unknown.
   */
  public async bulkUpsert(rows: BookCsvRow[]): Promise<{ created: number; updated: number; unchanged: number }> {
    const books = await booksRepository.findAll();
    const byId = new Map(books.map((book) => [book.id, book]));
    const unknown = rows.filter((row) => row.id !== null && !byId.has(row.id)).map((row) => row.id);
    if (unknown.length) {
      throw new BadRequestError(`No book has the id ${unknown.slice(0, 10).join(', ')}. Clear the id cell to add a new book instead.`);
    }
    const now = new Date().toISOString();
    let nextId = books.reduce((max, book) => Math.max(max, book.id), 0) + 1;
    const counts = { created: 0, updated: 0, unchanged: 0 };
    for (const { id, ...input } of rows) {
      const existing = id === null ? undefined : byId.get(id);
      if (!existing) {
        byId.set(nextId, { id: nextId, legacyId: null, ...input, createdAt: now, updatedAt: now });
        nextId += 1;
        counts.created += 1;
        continue;
      }
      const merged: Book = { ...existing, ...input };
      const changed = (Object.keys(input) as (keyof typeof input)[]).some((key) => merged[key] !== existing[key]);
      if (changed) {
        byId.set(existing.id, { ...merged, updatedAt: now });
        counts.updated += 1;
      } else {
        counts.unchanged += 1;
      }
    }
    if (counts.created || counts.updated) {
      await booksRepository.replaceAll([...byId.values()].sort((a, b) => a.id - b.id));
      contentEvents.changed('book');
    }
    return counts;
  }
}

export const libraryService = new LibraryService();
