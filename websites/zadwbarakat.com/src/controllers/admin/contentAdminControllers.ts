import type { Request } from 'express';
import type { ImageRef } from '../../domain/models.js';
import { filesFor, firstFile } from '../../middleware/upload.js';
import {
  albumFormSchema,
  articleFormSchema,
  articleListQuerySchema,
  bookFormSchema,
  catalogListQuerySchema,
  hymnFormSchema,
  purchaseFormSchema,
  sectionFormSchema,
  videoFormSchema
} from '../../schemas/adminSchemas.js';
import { albumsService } from '../../services/albumsService.js';
import { articlesService, articleUrl } from '../../services/articlesService.js';
import { hymnsService } from '../../services/hymnsService.js';
import type { ImagePreset } from '../../services/imageProcessingService.js';
import { libraryService } from '../../services/libraryService.js';
import { mediaService } from '../../services/mediaService.js';
import type { UploadedImage } from '../../services/pagesService.js';
import { pagesService } from '../../services/pagesService.js';
import { purchasesService } from '../../services/purchasesService.js';
import { sectionsService } from '../../services/sectionsService.js';
import { videosService } from '../../services/videosService.js';
import { crudController } from './crudController.js';

const ADMIN_PAGE_SIZE = 50;

const blankSeo = { title: '', description: '', keywords: '' };

function today(): string {
  return new Date().toISOString();
}

/** One optional image field (`imageFile`) processed with the given preset. */
function singleImage(folder: string, preset: ImagePreset) {
  return {
    saveUploads: async (req: Request): Promise<ImageRef | null> => {
      const file = firstFile(req, 'imageFile');
      if (!file) {
        return null;
      }
      const saved = await mediaService.saveImage(file, folder, preset);
      return { src: saved.url, width: saved.width, height: saved.height };
    },
    discard: async (image: ImageRef | null): Promise<void> => {
      if (image) {
        await mediaService.discard([{ url: image.src }]);
      }
    }
  };
}

function pageQuery(req: Request): { q: string; p: number } {
  const query = catalogListQuerySchema.parse(req.query);
  return { q: query.q, p: query.p ?? 1 };
}

export const SectionsAdminController = crudController({
  basePath: '/admin/sections',
  viewFolder: 'sections',
  plural: 'Sections',
  singular: 'section',
  schema: sectionFormSchema,
  blank: () => ({ id: null, title: '', path: '/', intro: '', image: '', status: 'published', sort: 100, seo: blankSeo }),
  listLocals: async () => {
    const [sections, counts] = await Promise.all([sectionsService.list(), sectionsService.articleCounts()]);
    return { rows: sections.map((section) => ({ ...section, articleCount: counts.get(section.id) ?? 0 })) };
  },
  getById: async (id) => sectionsService.getById(id),
  ...singleImage('sections', 'hero'),
  create: async (input, image) => sectionsService.create(input, image?.src ?? null),
  update: async (id, input, image) => sectionsService.update(id, input, image?.src ?? null),
  remove: async (id) => sectionsService.delete(id)
});

export const ArticlesAdminController = crudController({
  basePath: '/admin/articles',
  viewFolder: 'articles',
  plural: 'Articles',
  singular: 'article',
  schema: articleFormSchema,
  blank: () => ({
    id: null,
    title: '',
    slug: '',
    sectionId: null,
    summary: '',
    content: '',
    image: null,
    direction: 'auto',
    tags: [],
    status: 'published',
    publishedAt: today(),
    seo: blankSeo
  }),
  formOptions: async () => ({ sections: await sectionsService.list(), allTags: await articlesService.allTags() }),
  listLocals: async (req) => {
    const query = articleListQuerySchema.parse(req.query);
    const filter = { q: query.q, sectionId: query.section ?? null, status: query.status ?? null, page: query.p ?? 1 };
    const [result, sections] = await Promise.all([articlesService.adminList(filter, ADMIN_PAGE_SIZE), sectionsService.list()]);
    return { rows: result.rows, pagination: result.pagination, filter, sections };
  },
  getById: async (id) => {
    const article = await articlesService.getById(id);
    const section = (await sectionsService.byId()).get(article.sectionId);
    return { ...article, url: section ? articleUrl(article, section) : '' };
  },
  ...singleImage('articles', 'hero'),
  create: async (input, image) => articlesService.create(input, image),
  update: async (id, input, image) => articlesService.update(id, input, image),
  remove: async (id) => articlesService.delete(id)
});

export const BooksAdminController = crudController({
  basePath: '/admin/books',
  viewFolder: 'books',
  plural: 'Library books',
  singular: 'book',
  schema: bookFormSchema,
  blank: () => ({ id: null, title: '', author: '', publisher: '', language: 'عربي', genre: '', subject: '', format: '', year: '', pageCount: null, notes: '', active: true }),
  formOptions: async () => ({ genres: await libraryService.genres() }),
  listLocals: async (req) => {
    const query = pageQuery(req);
    const result = await libraryService.adminList(query.q, query.p, ADMIN_PAGE_SIZE);
    return { rows: result.rows, pagination: result.pagination, filter: query, libraryPage: await pagesService.findPublishedByKind('library') };
  },
  getById: async (id) => libraryService.getById(id),
  saveUploads: () => Promise.resolve(null),
  discard: () => Promise.resolve(),
  create: async (input) => libraryService.create(input),
  update: async (id, input) => libraryService.update(id, input),
  remove: async (id) => libraryService.delete(id)
});

export const HymnsAdminController = crudController({
  basePath: '/admin/hymns',
  viewFolder: 'hymns',
  plural: 'Hymns',
  singular: 'hymn',
  schema: hymnFormSchema,
  blank: () => ({ id: null, title: '', file: '', singer: '', author: '', album: '', category: '', sort: 100, active: true }),
  formOptions: async () => ({ categories: await hymnsService.categories() }),
  listLocals: async () => ({ rows: await hymnsService.list() }),
  getById: async (id) => hymnsService.getById(id),
  saveUploads: async (req) => {
    const file = firstFile(req, 'audioFile');
    return file ? (await mediaService.saveAudio(file, 'hymns')).url : null;
  },
  discard: async (url) => {
    if (url) {
      await mediaService.discard([{ url }]);
    }
  },
  create: async (input, url) => hymnsService.create(input, url),
  update: async (id, input, url) => hymnsService.update(id, input, url),
  remove: async (id) => hymnsService.delete(id)
});

export const AlbumsAdminController = crudController({
  basePath: '/admin/albums',
  viewFolder: 'albums',
  plural: 'Photo albums',
  singular: 'album',
  schema: albumFormSchema,
  blank: () => ({ id: null, title: '', slug: '', summary: '', images: [], status: 'published', sort: 100, publishedAt: today() }),
  listLocals: async () => ({ rows: await albumsService.list(), albumsPage: await pagesService.findPublishedByKind('albums') }),
  getById: async (id) => albumsService.getById(id),
  saveUploads: async (req) => {
    const saved: UploadedImage[] = [];
    try {
      for (const file of filesFor(req, 'imageFiles')) {
        saved.push(await mediaService.saveImage(file, 'albums', 'gallery'));
      }
      return saved;
    } catch (error) {
      await mediaService.discard(saved);
      throw error;
    }
  },
  discard: async (saved) => mediaService.discard(saved),
  create: async (input, saved) => albumsService.create(input, saved),
  update: async (id, input, saved) => albumsService.update(id, input, saved),
  remove: async (id) => albumsService.delete(id)
});

export const VideosAdminController = crudController({
  basePath: '/admin/videos',
  viewFolder: 'videos',
  plural: 'Videos',
  singular: 'video',
  schema: videoFormSchema,
  blank: () => ({ id: null, title: '', slug: '', summary: '', youtubeId: '', image: null, direction: 'auto', status: 'published', sort: 100, publishedAt: today() }),
  listLocals: async () => ({ rows: await videosService.list(), videosPage: await pagesService.findPublishedByKind('videos') }),
  getById: async (id) => videosService.getById(id),
  ...singleImage('videos', 'card'),
  create: async (input, image) => videosService.create(input, image),
  update: async (id, input, image) => videosService.update(id, input, image),
  remove: async (id) => videosService.delete(id)
});

export const PurchasesAdminController = crudController({
  basePath: '/admin/purchases',
  viewFolder: 'purchases',
  plural: 'Purchases',
  singular: 'item',
  schema: purchaseFormSchema,
  blank: () => ({ id: null, title: '', slug: '', category: '', author: '', price: '', summary: '', content: '', image: null, status: 'published', sort: 100 }),
  formOptions: async () => ({ categories: await purchasesService.categories() }),
  listLocals: async () => ({ rows: await purchasesService.list(), purchasesPage: await pagesService.findPublishedByKind('purchases') }),
  getById: async (id) => purchasesService.getById(id),
  ...singleImage('purchases', 'product'),
  create: async (input, image) => purchasesService.create(input, image),
  update: async (id, input, image) => purchasesService.update(id, input, image),
  remove: async (id) => purchasesService.delete(id)
});
