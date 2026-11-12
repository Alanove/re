import type { Section } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/httpError.js';
import { articlesRepository } from '../repositories/articlesRepository.js';
import { sectionsRepository } from '../repositories/contentRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { pagesRepository } from '../repositories/pagesRepository.js';
import type { SectionFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { isOwnedUpload } from './uploadOwnership.js';

function bySort(a: Section, b: Section): number {
  return a.sort - b.sort || a.id - b.id;
}

export class SectionsService {
  public async list(): Promise<Section[]> {
    return (await sectionsRepository.findAll()).sort(bySort);
  }

  public async listPublished(): Promise<Section[]> {
    return (await this.list()).filter((section) => section.status === 'published');
  }

  public async byId(): Promise<Map<number, Section>> {
    return new Map((await sectionsRepository.findAll()).map((section) => [section.id, section]));
  }

  public async getById(id: number): Promise<Section> {
    const section = await sectionsRepository.findById(id);
    if (!section) {
      throw new NotFoundError('Section not found.');
    }
    return section;
  }

  public async findPublishedByPath(sitePath: string): Promise<Section | null> {
    return (await this.listPublished()).find((section) => section.path === sitePath) ?? null;
  }

  public async articleCounts(): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    for (const article of await articlesRepository.snapshot()) {
      counts.set(article.sectionId, (counts.get(article.sectionId) ?? 0) + 1);
    }
    return counts;
  }

  public async create(input: SectionFormInput, image: string | null): Promise<Section> {
    await this.assertFreePath(input.path, null);
    const now = new Date().toISOString();
    const created = await sectionsRepository.insert({
      path: input.path,
      title: input.title,
      intro: input.intro,
      image: image ?? input.image,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      createdAt: now,
      updatedAt: now
    });
    contentEvents.changed('section', created.id);
    return created;
  }

  public async update(id: number, input: SectionFormInput, image: string | null): Promise<Section> {
    const existing = await this.getById(id);
    await this.assertFreePath(input.path, id);
    let nextImage = input.removeImage ? '' : input.image || existing.image;
    if (image) {
      nextImage = image;
    }
    if (existing.image && existing.image !== nextImage && isOwnedUpload(existing.image)) {
      await mediaRepository.remove(existing.image);
    }
    const saved = await sectionsRepository.replace({
      ...existing,
      path: input.path,
      title: input.title,
      intro: input.intro,
      image: nextImage,
      status: input.published ? 'published' : 'draft',
      sort: input.sort,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      updatedAt: new Date().toISOString()
    });
    contentEvents.changed('section', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const section = await this.getById(id);
    if ((await articlesRepository.snapshot()).some((article) => article.sectionId === id)) {
      throw new ConflictError('Move or delete the articles in this section first.');
    }
    if (section.image && isOwnedUpload(section.image)) {
      await mediaRepository.remove(section.image);
    }
    await sectionsRepository.remove(id);
    contentEvents.changed('section', id);
  }

  /** A section path may not collide with another section or with a page address. */
  private async assertFreePath(sitePath: string, selfId: number | null): Promise<void> {
    const sections = await sectionsRepository.findAll();
    if (sections.some((section) => section.path === sitePath && section.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { path: 'Another section already uses this address' });
    }
    const pages = await pagesRepository.findAll();
    const byId = new Map(pages.map((page) => [page.id, page]));
    const pageUrl = (pageId: number): string => {
      const segments: string[] = [];
      let cursor = byId.get(pageId);
      const seen = new Set<number>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        segments.unshift(cursor.slug);
        cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      }
      return `/${segments.join('/')}`;
    };
    if (pages.some((page) => pageUrl(page.id) === sitePath)) {
      throw new BadRequestError('Please correct the highlighted fields.', { path: 'A page already uses this address' });
    }
  }
}

export const sectionsService = new SectionsService();
