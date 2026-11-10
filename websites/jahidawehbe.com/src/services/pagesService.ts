import type { CollectionKind, Page, PageImage, PageKind } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/httpError.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { pageImagesRepository } from '../repositories/pageImagesRepository.js';
import { pagesRepository } from '../repositories/pagesRepository.js';
import type { PageFormInput } from '../schemas/adminSchemas.js';
import { sanitizeRichText, slugify } from './sanitizeService.js';

export interface PageNode extends Page {
  url: string;
  depth: number;
  children: PageNode[];
  ancestors: { id: number; title: string; url: string }[];
}

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface UploadedVideo {
  url: string;
}

export interface PageUploads {
  hero: UploadedImage | null;
  heroVideo: UploadedVideo | null;
  gallery: UploadedImage[];
}

/** Kinds that exist at most once and own a fixed place in the site. */
const SINGLETON_KINDS = new Set<PageKind>(['news', 'events', 'videos']);

function bySort(a: Page, b: Page): number {
  return a.sort - b.sort || a.id - b.id;
}

function buildTree(pages: Page[]): { roots: PageNode[]; byId: Map<number, PageNode> } {
  const byId = new Map<number, PageNode>();
  for (const page of pages) {
    byId.set(page.id, { ...page, url: '', depth: 0, children: [], ancestors: [] });
  }
  const roots: PageNode[] = [];
  for (const page of [...pages].sort(bySort)) {
    const node = byId.get(page.id);
    if (!node) {
      continue;
    }
    const parent = page.parentId === null ? undefined : byId.get(page.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const assign = (nodes: PageNode[], prefix: string, depth: number, ancestors: PageNode['ancestors']): void => {
    for (const node of nodes) {
      node.url = `${prefix}/${node.slug}`;
      node.depth = depth;
      node.ancestors = ancestors;
      assign(node.children, node.url, depth + 1, [...ancestors, { id: node.id, title: node.title, url: node.url }]);
    }
  };
  assign(roots, '', 0, []);
  return { roots, byId };
}

function flatten(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function filterPublished(nodes: PageNode[]): PageNode[] {
  return nodes.filter((node) => node.status === 'published').map((node) => ({ ...node, children: filterPublished(node.children) }));
}

function indexById(nodes: PageNode[]): Map<number, PageNode> {
  const byId = new Map<number, PageNode>();
  const walk = (list: PageNode[]): void => {
    for (const node of list) {
      byId.set(node.id, node);
      walk(node.children);
    }
  };
  walk(nodes);
  return byId;
}

function heroFromPageOrParent(page: PageNode, byId: Map<number, PageNode>): { heroImage: string; heroVideo: string } {
  if (page.heroImage || page.heroVideo) {
    return { heroImage: page.heroImage, heroVideo: page.heroVideo };
  }
  let parentId = page.parentId;
  const seen = new Set<number>();
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    if (parent.heroImage || parent.heroVideo) {
      return { heroImage: parent.heroImage, heroVideo: parent.heroVideo };
    }
    parentId = parent.parentId;
  }
  return { heroImage: '', heroVideo: '' };
}

export function withParentHero(page: PageNode, byId: Map<number, PageNode>): PageNode {
  const hero = heroFromPageOrParent(page, byId);
  return {
    ...page,
    heroImage: hero.heroImage,
    heroVideo: hero.heroVideo,
    children: page.children.map((child) => withParentHero(child, byId))
  };
}

export function isCollectionKind(kind: PageKind): kind is CollectionKind {
  return kind === 'news' || kind === 'events';
}

export class PagesService {
  public async getTree(): Promise<PageNode[]> {
    const pages = await pagesRepository.findAll();
    return buildTree(pages).roots;
  }

  public async getFlatList(): Promise<PageNode[]> {
    return flatten(await this.getTree());
  }

  public async getPublishedTree(): Promise<PageNode[]> {
    return filterPublished(await this.getTree());
  }

  public async inheritHeroForPublish(page: PageNode): Promise<PageNode> {
    const byId = indexById(await this.getPublishedTree());
    return withParentHero(page, byId);
  }

  public async findPublishedByPath(requestPath: string): Promise<PageNode | null> {
    const normalized = `/${requestPath.split('/').filter(Boolean).map((part) => part.toLowerCase()).join('/')}`;
    const published = flatten(await this.getPublishedTree());
    return published.find((node) => node.url === normalized) ?? null;
  }

  public async findPublishedByKey(key: string): Promise<PageNode | null> {
    const published = flatten(await this.getPublishedTree());
    return published.find((node) => node.key === key) ?? null;
  }

  public async findPublishedByKind(kind: PageKind): Promise<PageNode | null> {
    const published = flatten(await this.getPublishedTree());
    return published.find((node) => node.kind === kind) ?? null;
  }

  public async getSectionRoot(page: PageNode): Promise<PageNode> {
    const rootId = page.ancestors[0]?.id ?? page.id;
    const tree = await this.getPublishedTree();
    return tree.find((node) => node.id === rootId) ?? page;
  }

  public async getPageImages(pageId: number): Promise<PageImage[]> {
    return pageImagesRepository.findByPage(pageId);
  }

  public async getById(id: number): Promise<PageNode> {
    const { byId } = buildTree(await pagesRepository.findAll());
    const node = byId.get(id);
    if (!node) {
      throw new NotFoundError('Page not found.');
    }
    return node;
  }

  public async findByKey(key: string): Promise<PageNode | null> {
    const list = await this.getFlatList();
    return list.find((node) => node.key === key) ?? null;
  }

  public async getImageCounts(): Promise<Map<number, number>> {
    return pageImagesRepository.countByPage();
  }

  public async getCollectionRoot(kind: CollectionKind): Promise<PageNode | null> {
    return (await this.getFlatList()).find((node) => node.kind === kind) ?? null;
  }

  public isEntryOf(page: Pick<Page, 'parentId'>, root: Pick<Page, 'id'> | null): boolean {
    return root !== null && page.parentId === root.id;
  }

  /** Pages managed under Pages: everything except the news and events roots and their entries. */
  public async getPagesList(): Promise<PageNode[]> {
    const list = await this.getFlatList();
    const collectionIds = new Set(list.filter((node) => isCollectionKind(node.kind)).map((node) => node.id));
    return list.filter((node) => !collectionIds.has(node.id) && !node.ancestors.some((ancestor) => collectionIds.has(ancestor.id)));
  }

  public async getCollectionOverview(kind: CollectionKind): Promise<{ root: PageNode | null; entries: PageNode[] }> {
    const root = await this.getCollectionRoot(kind);
    if (!root) {
      return { root: null, entries: [] };
    }
    const entries = [...root.children].sort((a, b) => {
      const dateA = kind === 'events' && a.eventDate ? a.eventDate : a.createdAt;
      const dateB = kind === 'events' && b.eventDate ? b.eventDate : b.createdAt;
      return dateB.localeCompare(dateA) || b.id - a.id;
    });
    return { root, entries };
  }

  public async createPage(input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const pages = await pagesRepository.findAll();
    this.assertOutsideCollections(pages, input, null);
    return this.create(input, uploads);
  }

  public async updatePage(id: number, input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const pages = await pagesRepository.findAll();
    const existing = pages.find((page) => page.id === id);
    if (!existing || pages.some((page) => isCollectionKind(page.kind) && page.id === existing.parentId)) {
      throw new NotFoundError('Page not found.');
    }
    if (SINGLETON_KINDS.has(existing.kind)) {
      return this.update(id, { ...input, kind: existing.kind, parentId: existing.parentId }, uploads);
    }
    this.assertOutsideCollections(pages, input, id);
    return this.update(id, input, uploads);
  }

  public async createEntry(kind: CollectionKind, input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const root = await this.requireCollectionRoot(kind);
    return this.create({ ...input, kind: 'page', parentId: root.id }, uploads);
  }

  public async updateEntry(kind: CollectionKind, id: number, input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const root = await this.requireCollectionRoot(kind);
    const existing = await pagesRepository.findById(id);
    if (!existing || !this.isEntryOf(existing, root)) {
      throw new NotFoundError(kind === 'news' ? 'News story not found.' : 'Event not found.');
    }
    return this.update(id, { ...input, kind: 'page', parentId: root.id }, uploads);
  }

  private async requireCollectionRoot(kind: CollectionKind): Promise<Page> {
    const root = (await pagesRepository.findAll()).find((page) => page.kind === kind);
    if (!root) {
      throw new NotFoundError(`The ${kind} page does not exist.`);
    }
    return root;
  }

  private assertOutsideCollections(pages: Page[], input: PageFormInput, selfId: number | null): void {
    if (SINGLETON_KINDS.has(input.kind) && pages.some((page) => page.kind === input.kind && page.id !== selfId)) {
      throw new BadRequestError('Please correct the highlighted fields.', { kind: `The site already has a ${input.kind} page` });
    }
    const byId = new Map(pages.map((page) => [page.id, page]));
    let cursor = input.parentId;
    const seen = new Set<number>();
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = byId.get(cursor);
      if (parent && isCollectionKind(parent.kind)) {
        throw new BadRequestError('Please correct the highlighted fields.', {
          parentId: parent.kind === 'news' ? 'Write news stories from the News screen' : 'Add events from the Events screen'
        });
      }
      cursor = parent?.parentId ?? null;
    }
  }

  private async create(input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const pages = await pagesRepository.findAll();
    const slug = input.slug || slugify(input.title);
    if (!slug) {
      throw new BadRequestError('Please correct the highlighted fields.', { slug: 'Enter a slug using letters or numbers (Arabic titles need an English slug)' });
    }
    this.assertParent(pages, input.parentId, null);
    this.assertUniqueSlug(pages, slug, input.parentId, null);
    const key = this.uniqueKey(pages, slug);
    const now = new Date().toISOString();
    const created = await pagesRepository.insert({
      key,
      parentId: input.parentId,
      slug,
      title: input.title,
      header: input.header,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      status: input.published ? 'published' : 'draft',
      kind: input.kind,
      direction: input.direction,
      sort: input.sort,
      heroImage: uploads.hero?.url ?? input.heroImage,
      heroVideo: uploads.heroVideo?.url ?? input.heroVideo,
      eventDate: input.eventDate,
      venue: input.venue,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      createdAt: now,
      updatedAt: now
    });
    await this.addGallery(created.id, uploads.gallery, 0);
    return this.getById(created.id);
  }

  private async update(id: number, input: PageFormInput, uploads: PageUploads): Promise<PageNode> {
    const pages = await pagesRepository.findAll();
    const existing = pages.find((page) => page.id === id);
    if (!existing) {
      throw new NotFoundError('Page not found.');
    }
    const slug = input.slug || existing.slug;
    this.assertParent(pages, input.parentId, id);
    this.assertUniqueSlug(pages, slug, input.parentId, id);

    let heroImage = input.removeHeroImage ? '' : input.heroImage || existing.heroImage;
    if (uploads.hero) {
      heroImage = uploads.hero.url;
    }
    if (existing.heroImage && existing.heroImage !== heroImage && this.isOwnedUpload(existing.heroImage)) {
      await mediaRepository.remove(existing.heroImage);
    }
    let heroVideo = input.removeHeroVideo ? '' : input.heroVideo || existing.heroVideo;
    if (uploads.heroVideo) {
      heroVideo = uploads.heroVideo.url;
    }
    if (existing.heroVideo && existing.heroVideo !== heroVideo && this.isOwnedUpload(existing.heroVideo)) {
      await mediaRepository.remove(existing.heroVideo);
    }

    await pagesRepository.replace({
      ...existing,
      parentId: input.parentId,
      slug,
      title: input.title,
      header: input.header,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      status: input.published ? 'published' : 'draft',
      kind: input.kind,
      direction: input.direction,
      sort: input.sort,
      heroImage,
      heroVideo,
      eventDate: input.eventDate,
      venue: input.venue,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      seo: { title: input.seoTitle, description: input.seoDescription, keywords: input.seoKeywords },
      updatedAt: new Date().toISOString()
    });

    const current = await pageImagesRepository.findByPage(id);
    const currentIds = new Set(current.map((image) => image.id));
    const rows = input.gallery.filter((row) => currentIds.has(row.id));
    for (const row of rows.filter((item) => item.remove)) {
      const removed = await pageImagesRepository.remove(row.id);
      if (removed && this.isOwnedUpload(removed.src)) {
        await mediaRepository.remove(removed.src);
      }
    }
    await pageImagesRepository.updateCaptionsAndSort(
      id,
      rows.filter((row) => !row.remove).map((row) => ({ id: row.id, caption: row.caption, sort: row.sort }))
    );
    const maxSort = current.reduce((max, image) => Math.max(max, image.sort), 0);
    await this.addGallery(id, uploads.gallery, maxSort);
    return this.getById(id);
  }

  public async delete(id: number): Promise<void> {
    const pages = await pagesRepository.findAll();
    const target = pages.find((page) => page.id === id);
    if (!target) {
      throw new NotFoundError('Page not found.');
    }
    if (SINGLETON_KINDS.has(target.kind)) {
      throw new ConflictError(`The ${target.kind} page cannot be deleted.`);
    }
    if (pages.some((page) => page.parentId === id)) {
      throw new ConflictError('Move or delete the child pages first.');
    }
    const removedImages = await pageImagesRepository.removeByPage(id);
    for (const image of removedImages) {
      if (this.isOwnedUpload(image.src)) {
        await mediaRepository.remove(image.src);
      }
    }
    if (target.heroImage && this.isOwnedUpload(target.heroImage)) {
      await mediaRepository.remove(target.heroImage);
    }
    if (target.heroVideo && this.isOwnedUpload(target.heroVideo)) {
      await mediaRepository.remove(target.heroVideo);
    }
    await pagesRepository.remove(id);
  }

  public async removeHeroImage(id: number): Promise<void> {
    const page = await pagesRepository.findById(id);
    if (!page) {
      throw new NotFoundError('Page not found.');
    }
    if (page.heroImage && this.isOwnedUpload(page.heroImage)) {
      await mediaRepository.remove(page.heroImage);
    }
    await pagesRepository.replace({ ...page, heroImage: '', updatedAt: new Date().toISOString() });
  }

  public async isSlugAvailable(slug: string, parentId: number | null, excludeId: number | null): Promise<boolean> {
    const pages = await pagesRepository.findAll();
    return !pages.some((page) => page.slug === slug && page.parentId === parentId && page.id !== excludeId);
  }

  private async addGallery(pageId: number, gallery: UploadedImage[], startSort: number): Promise<void> {
    if (gallery.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    await pageImagesRepository.insertMany(
      gallery.map((image, index) => ({
        pageId,
        sort: startSort + (index + 1) * 10,
        caption: '',
        src: image.url,
        width: image.width,
        height: image.height,
        createdAt: now
      }))
    );
  }

  private isOwnedUpload(url: string): boolean {
    return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
  }

  private assertParent(pages: Page[], parentId: number | null, selfId: number | null): void {
    if (parentId === null) {
      return;
    }
    const byId = new Map(pages.map((page) => [page.id, page]));
    if (!byId.has(parentId)) {
      throw new BadRequestError('Please correct the highlighted fields.', { parentId: 'The parent page does not exist' });
    }
    let cursor: number | null = parentId;
    const seen = new Set<number>();
    while (cursor !== null) {
      if (cursor === selfId || seen.has(cursor)) {
        throw new BadRequestError('Please correct the highlighted fields.', { parentId: 'A page cannot be placed under itself' });
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }

  private assertUniqueSlug(pages: Page[], slug: string, parentId: number | null, selfId: number | null): void {
    if (pages.some((page) => page.slug === slug && page.parentId === parentId && page.id !== selfId)) {
      throw new ConflictError('Please correct the highlighted fields.', { slug: 'Another page under the same parent uses this slug' });
    }
  }

  private uniqueKey(pages: Page[], slug: string): string {
    const keys = new Set(pages.map((page) => page.key));
    if (!keys.has(slug)) {
      return slug;
    }
    let counter = 2;
    while (keys.has(`${slug}-${counter}`)) {
      counter += 1;
    }
    return `${slug}-${counter}`;
  }
}

export const pagesService = new PagesService();
