import type { ImageRef, Purchase } from '../domain/models.js';
import { ConflictError, NotFoundError } from '../errors/httpError.js';
import { slugifyArabic } from '../lib/arabicNormalize.js';
import { purchasesRepository } from '../repositories/contentRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { PurchaseFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { sanitizeRichText } from './sanitizeService.js';
import { isOwnedUpload } from './uploadOwnership.js';

function ordered(a: Purchase, b: Purchase): number {
  return a.category.localeCompare(b.category, 'ar') || a.sort - b.sort || a.id - b.id;
}

export interface PurchaseGroup {
  category: string;
  items: Purchase[];
}

export class PurchasesService {
  public async list(): Promise<Purchase[]> {
    return (await purchasesRepository.findAll()).sort(ordered);
  }

  public async groupedPublished(): Promise<PurchaseGroup[]> {
    const groups = new Map<string, Purchase[]>();
    for (const item of (await this.list()).filter((entry) => entry.status === 'published')) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items }));
  }

  public async findPublishedBySlug(slug: string): Promise<Purchase | null> {
    return (await this.list()).find((item) => item.slug === slug && item.status === 'published') ?? null;
  }

  public async findPublishedById(id: number): Promise<Purchase | null> {
    const item = await purchasesRepository.findById(id);
    return item && item.status === 'published' ? item : null;
  }

  public async categories(): Promise<string[]> {
    return [...new Set((await purchasesRepository.findAll()).map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'ar'));
  }

  public async getById(id: number): Promise<Purchase> {
    const item = await purchasesRepository.findById(id);
    if (!item) {
      throw new NotFoundError('Item not found.');
    }
    return item;
  }

  public async create(input: PurchaseFormInput, image: ImageRef | null): Promise<Purchase> {
    const slug = input.slug || slugifyArabic(input.title);
    await this.assertFreeSlug(slug, null);
    const now = new Date().toISOString();
    const created = await purchasesRepository.insert({
      legacyId: null,
      category: input.category,
      slug,
      title: input.title,
      author: input.author,
      price: input.price,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      image: image ?? (input.image ? { src: input.image, width: null, height: null } : null),
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      createdAt: now,
      updatedAt: now
    });
    contentEvents.changed('purchase', created.id);
    return created;
  }

  public async update(id: number, input: PurchaseFormInput, image: ImageRef | null): Promise<Purchase> {
    const existing = await this.getById(id);
    const slug = input.slug || existing.slug;
    await this.assertFreeSlug(slug, id);
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
    const saved = await purchasesRepository.replace({
      ...existing,
      category: input.category,
      slug,
      title: input.title,
      author: input.author,
      price: input.price,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      image: nextImage,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      updatedAt: new Date().toISOString()
    });
    contentEvents.changed('purchase', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await purchasesRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Item not found.');
    }
    if (removed.image && isOwnedUpload(removed.image.src)) {
      await mediaRepository.remove(removed.image.src);
    }
    contentEvents.changed('purchase', id);
  }

  private async assertFreeSlug(slug: string, selfId: number | null): Promise<void> {
    if ((await purchasesRepository.findAll()).some((item) => item.slug === slug && item.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another item uses this slug' });
    }
  }
}

export const purchasesService = new PurchasesService();
