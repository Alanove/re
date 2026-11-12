import { thumbUrl } from '../domain/media.js';
import type { Article, Direction, ImageRef, Section } from '../domain/models.js';
import { ConflictError, NotFoundError } from '../errors/httpError.js';
import { detectDirection, relaxOpposingDirections, slugifyArabic } from '../lib/arabicNormalize.js';
import { articlesRepository } from '../repositories/articlesRepository.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { ArticleFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { formatDate, paginate, readingMinutes, type Pagination } from './format.js';
import { sanitizeRichText, toPlainText } from './sanitizeService.js';
import { sectionsService } from './sectionsService.js';
import { isOwnedUpload } from './uploadOwnership.js';

export const SECTION_PAGE_SIZE = 12;

export interface ArticleCard {
  id: number;
  title: string;
  summary: string;
  url: string;
  image: string;
  imageWidth: number | null;
  imageHeight: number | null;
  date: string;
  publishedAt: string;
  sectionTitle: string;
  sectionUrl: string;
  direction: 'rtl' | 'ltr';
}

export interface ArticleView {
  article: Article;
  section: Section;
  url: string;
  direction: 'rtl' | 'ltr';
  date: string;
  minutes: number;
  newer: ArticleCard | null;
  older: ArticleCard | null;
  related: ArticleCard[];
}

export interface AdminArticleFilter {
  q: string;
  sectionId: number | null;
  status: 'published' | 'draft' | null;
  page: number;
}

export function effectiveDirection(direction: Direction, text: string): 'rtl' | 'ltr' {
  return direction === 'auto' ? detectDirection(text) : direction;
}

function newestFirst(a: Article, b: Article): number {
  return b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id;
}

export function articleUrl(article: Pick<Article, 'slug'>, section: Pick<Section, 'path'>): string {
  return `${section.path}/${article.slug}`;
}

export class ArticlesService {
  private sorted: { revision: number; items: readonly Article[] } | null = null;

  public toCard(article: Article, section: Section): ArticleCard {
    const direction = effectiveDirection(article.direction, `${article.title} ${article.summary}`);
    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: articleUrl(article, section),
      image: article.image ? thumbUrl(article.image.src) : '',
      imageWidth: article.image?.width ?? null,
      imageHeight: article.image?.height ?? null,
      date: article.dateKnown ? formatDate(article.publishedAt, direction) : '',
      publishedAt: article.publishedAt,
      sectionTitle: section.title,
      sectionUrl: section.path,
      direction
    };
  }

  /** Published articles in published sections, newest first; cached until an article is written. */
  public async publishedNewestFirst(): Promise<readonly Article[]> {
    const revision = articlesRepository.revision;
    if (!this.sorted || this.sorted.revision !== revision) {
      const all = await articlesRepository.snapshot();
      this.sorted = { revision, items: all.filter((article) => article.status === 'published').sort(newestFirst) };
    }
    const published = new Set((await sectionsService.listPublished()).map((section) => section.id));
    return this.sorted.items.filter((article) => published.has(article.sectionId));
  }

  public async sectionListing(section: Section, page: number): Promise<{ cards: ArticleCard[]; pagination: Pagination } | null> {
    const items = (await this.publishedNewestFirst()).filter((article) => article.sectionId === section.id);
    const result = paginate(items, page, SECTION_PAGE_SIZE);
    if (!result) {
      return null;
    }
    return { cards: result.slice.map((article) => this.toCard(article, section)), pagination: result.pagination };
  }

  public async latest(sectionId: number | null, count: number): Promise<ArticleCard[]> {
    const sections = await sectionsService.byId();
    const items = (await this.publishedNewestFirst()).filter((article) => sectionId === null || article.sectionId === sectionId);
    const cards: ArticleCard[] = [];
    for (const article of items.slice(0, count)) {
      const section = sections.get(article.sectionId);
      if (section) {
        cards.push(this.toCard(article, section));
      }
    }
    return cards;
  }

  public async cardsByIds(ids: readonly number[]): Promise<Map<number, ArticleCard>> {
    const sections = await sectionsService.byId();
    const all = await articlesRepository.snapshot();
    const wanted = new Set(ids);
    const cards = new Map<number, ArticleCard>();
    for (const article of all) {
      const section = sections.get(article.sectionId);
      if (wanted.has(article.id) && section && article.status === 'published' && section.status === 'published') {
        cards.set(article.id, this.toCard(article, section));
      }
    }
    return cards;
  }

  /** `relatedIds` come from the search index (most similar first); the article itself is skipped. */
  public async view(section: Section, slug: string, relatedIds: (article: Article) => Promise<number[]>): Promise<ArticleView | null> {
    const items = (await this.publishedNewestFirst()).filter((article) => article.sectionId === section.id);
    const index = items.findIndex((article) => article.slug === slug);
    const article = items[index];
    if (!article) {
      return null;
    }
    const newer = index > 0 ? items[index - 1] : undefined;
    const older = items[index + 1];
    const direction = effectiveDirection(article.direction, `${article.title} ${toPlainText(article.content).slice(0, 2000)}`);
    const ids = (await relatedIds(article)).filter((id) => id !== article.id).slice(0, 3);
    const cards = await this.cardsByIds(ids);
    return {
      article: { ...structuredClone(article), content: relaxOpposingDirections(article.content, direction) },
      section,
      url: articleUrl(article, section),
      direction,
      date: article.dateKnown ? formatDate(article.publishedAt, direction) : '',
      minutes: readingMinutes(article.content),
      newer: newer ? this.toCard(newer, section) : null,
      older: older ? this.toCard(older, section) : null,
      related: ids.map((id) => cards.get(id)).filter((card): card is ArticleCard => card !== undefined)
    };
  }

  public async adminList(filter: AdminArticleFilter, pageSize: number): Promise<{ rows: (Article & { url: string; sectionTitle: string })[]; pagination: Pagination }> {
    const sections = await sectionsService.byId();
    const needle = filter.q.trim().toLowerCase();
    const items = [...(await articlesRepository.snapshot())]
      .filter((article) => filter.sectionId === null || article.sectionId === filter.sectionId)
      .filter((article) => filter.status === null || article.status === filter.status)
      .filter((article) => !needle || article.title.toLowerCase().includes(needle) || String(article.legacyId ?? '') === needle)
      .sort(newestFirst);
    const result = paginate(items, filter.page, pageSize) ?? paginate(items, 1, pageSize);
    const slice = result?.slice ?? [];
    return {
      rows: slice.map((article) => {
        const section = sections.get(article.sectionId);
        return { ...article, url: section ? articleUrl(article, section) : '', sectionTitle: section?.title ?? '' };
      }),
      pagination: result?.pagination ?? { page: 1, totalPages: 1, total: 0, pageSize }
    };
  }

  public async getById(id: number): Promise<Article> {
    const article = await articlesRepository.findById(id);
    if (!article) {
      throw new NotFoundError('Article not found.');
    }
    return article;
  }

  public async create(input: ArticleFormInput, image: ImageRef | null): Promise<Article> {
    await sectionsService.getById(input.sectionId);
    const slug = input.slug || slugifyArabic(input.title);
    await this.assertFreeSlug(input.sectionId, slug, null);
    const now = new Date().toISOString();
    const content = sanitizeRichText(input.content);
    const created = await articlesRepository.insert({
      legacyId: null,
      sectionId: input.sectionId,
      slug,
      title: input.title,
      summary: input.summary || toPlainText(content).slice(0, 280),
      content,
      image: image ?? (input.image ? { src: input.image, width: null, height: null } : null),
      direction: input.direction,
      tags: input.tags,
      status: input.published ? 'published' : 'draft',
      publishedAt: input.publishedAt ?? now,
      dateKnown: true,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      createdAt: now,
      updatedAt: now
    });
    contentEvents.changed('article', created.id);
    return created;
  }

  public async update(id: number, input: ArticleFormInput, image: ImageRef | null): Promise<Article> {
    const existing = await this.getById(id);
    await sectionsService.getById(input.sectionId);
    const slug = input.slug || existing.slug;
    await this.assertFreeSlug(input.sectionId, slug, id);

    let nextImage: ImageRef | null = input.removeImage ? null : existing.image;
    if (!input.removeImage && input.image && input.image !== existing.image?.src) {
      nextImage = { src: input.image, width: null, height: null };
    }
    if (image) {
      nextImage = image;
    }
    if (existing.image && existing.image.src !== nextImage?.src && isOwnedUpload(existing.image.src)) {
      await mediaRepository.remove(existing.image.src);
    }
    const content = sanitizeRichText(input.content);
    const saved = await articlesRepository.replace({
      ...existing,
      sectionId: input.sectionId,
      slug,
      title: input.title,
      summary: input.summary || toPlainText(content).slice(0, 280),
      content,
      image: nextImage,
      direction: input.direction,
      tags: input.tags,
      status: input.published ? 'published' : 'draft',
      publishedAt: input.publishedAt ?? existing.publishedAt,
      dateKnown: input.publishedAt !== null || existing.dateKnown,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      updatedAt: new Date().toISOString()
    });
    contentEvents.changed('article', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await articlesRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Article not found.');
    }
    if (removed.image && isOwnedUpload(removed.image.src)) {
      await mediaRepository.remove(removed.image.src);
    }
    contentEvents.changed('article', id);
  }

  public async allTags(): Promise<string[]> {
    const tags = new Set<string>();
    for (const article of await articlesRepository.snapshot()) {
      for (const tag of article.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'ar'));
  }

  private async assertFreeSlug(sectionId: number, slug: string, selfId: number | null): Promise<void> {
    const all = await articlesRepository.snapshot();
    if (all.some((article) => article.sectionId === sectionId && article.slug === slug && article.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another article in this section uses this slug' });
    }
  }
}

export const articlesService = new ArticlesService();
