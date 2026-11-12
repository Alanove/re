import { DATA_FILES } from '../config/paths.js';
import {
  albumsFileSchema,
  booksFileSchema,
  hymnsFileSchema,
  purchasesFileSchema,
  sectionsFileSchema,
  videosFileSchema,
  type Album,
  type Book,
  type Hymn,
  type Purchase,
  type Section,
  type Video
} from '../domain/models.js';
import { CollectionRepository } from './collectionRepository.js';

export const sectionsRepository = new CollectionRepository<Section>(DATA_FILES.sections, sectionsFileSchema);
export const booksRepository = new CollectionRepository<Book>(DATA_FILES.books, booksFileSchema);
export const hymnsRepository = new CollectionRepository<Hymn>(DATA_FILES.hymns, hymnsFileSchema);
export const albumsRepository = new CollectionRepository<Album>(DATA_FILES.albums, albumsFileSchema);
export const videosRepository = new CollectionRepository<Video>(DATA_FILES.videos, videosFileSchema);
export const purchasesRepository = new CollectionRepository<Purchase>(DATA_FILES.purchases, purchasesFileSchema);
