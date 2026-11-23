import type { Submission } from '../domain/models.js';
import { albumsService } from './albumsService.js';
import { contactService } from './contactService.js';
import { officesService } from './officesService.js';
import { pagesService } from './pagesService.js';
import { usersService } from './usersService.js';

export interface DashboardSummary {
  pages: { total: number; published: number; drafts: number };
  albums: { total: number; published: number; drafts: number };
  news: { stories: number; published: number; drafts: number; listingId: number | null };
  galleryImages: number;
  offices: number;
  users: number;
  inquiries: { total: number; unread: number; latest: Submission[] };
  recentPages: { id: number; title: string; url: string; updatedAt: string; editUrl: string }[];
}

function editUrlFor(page: { id: number; kind: string; parentId: number | null; key: string }, productsRootId: number | null, newsRootId: number | null, categoryIds: Set<number>): string {
  if (newsRootId !== null && (page.id === newsRootId || page.parentId === newsRootId)) {
    return `/admin/news/${page.id}/edit`;
  }
  if (productsRootId !== null) {
    if (page.id === productsRootId || (page.parentId !== null && categoryIds.has(page.parentId))) {
      return `/admin/products/${page.id}/edit`;
    }
    if (categoryIds.has(page.id)) {
      return `/admin/categories/${page.id}/edit`;
    }
  }
  return `/admin/pages/${page.id}/edit`;
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [contentPages, albums, newsOverview, imageCounts, offices, users, inquiries, productsRoot] = await Promise.all([
      pagesService.getPagesList(),
      albumsService.list(),
      pagesService.getNewsOverview(),
      pagesService.getImageCounts(),
      officesService.list(),
      usersService.list(),
      contactService.list(),
      pagesService.getProductsRoot()
    ]);
    const categories = await pagesService.getCategoriesList();
    const categoryIds = new Set(categories.map((category) => category.id));
    const stories = newsOverview.entries;
    const recentSource = [...contentPages, ...stories, ...(newsOverview.root ? [newsOverview.root] : [])];
    return {
      pages: {
        total: contentPages.length,
        published: contentPages.filter((page) => page.status === 'published').length,
        drafts: contentPages.filter((page) => page.status === 'draft').length
      },
      albums: {
        total: albums.length,
        published: albums.filter((album) => album.status === 'published').length,
        drafts: albums.filter((album) => album.status === 'draft').length
      },
      news: {
        stories: stories.length,
        published: stories.filter((page) => page.status === 'published').length,
        drafts: stories.filter((page) => page.status === 'draft').length,
        listingId: newsOverview.root?.id ?? null
      },
      galleryImages: [...imageCounts.values()].reduce((sum, count) => sum + count, 0),
      offices: offices.length,
      users: users.length,
      inquiries: {
        total: inquiries.length,
        unread: inquiries.filter((item) => !item.read).length,
        latest: inquiries.slice(0, 5)
      },
      recentPages: recentSource
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map((page) => ({
          id: page.id,
          title: page.title,
          url: page.url,
          updatedAt: page.updatedAt,
          editUrl: editUrlFor(page, productsRoot?.id ?? null, newsOverview.root?.id ?? null, categoryIds)
        }))
    };
  }
}

export const dashboardService = new DashboardService();
