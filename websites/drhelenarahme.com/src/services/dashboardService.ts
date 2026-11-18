import type { Submission } from '../domain/models.js';
import { contactService } from './contactService.js';
import { officesService } from './officesService.js';
import { pagesService } from './pagesService.js';
import { usersService } from './usersService.js';

export interface DashboardSummary {
  pages: { total: number; published: number; drafts: number };
  galleryImages: number;
  blog: { posts: number; published: number; drafts: number; listingId: number | null };
  offices: number;
  users: number;
  inquiries: { total: number; unread: number; latest: Submission[] };
  recentPages: { id: number; title: string; url: string; updatedAt: string; editUrl: string }[];
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [pages, imageCounts, offices, users, inquiries] = await Promise.all([
      pagesService.getFlatList(),
      pagesService.getImageCounts(),
      officesService.list(),
      usersService.list(),
      contactService.list()
    ]);
    const blogIds = new Set(pages.filter((page) => page.kind === 'blog').map((page) => page.id));
    const posts = pages.filter((page) => page.parentId !== null && blogIds.has(page.parentId));
    const routable = pages.filter((page) => page.kind !== 'footer');
    const contentPages = routable.filter((page) => !blogIds.has(page.id) && !page.ancestors.some((ancestor) => blogIds.has(ancestor.id)));
    return {
      pages: {
        total: contentPages.length,
        published: contentPages.filter((page) => page.status === 'published').length,
        drafts: contentPages.filter((page) => page.status === 'draft').length
      },
      galleryImages: [...imageCounts.values()].reduce((sum, count) => sum + count, 0),
      blog: {
        posts: posts.length,
        published: posts.filter((page) => page.status === 'published').length,
        drafts: posts.filter((page) => page.status === 'draft').length,
        listingId: [...blogIds][0] ?? null
      },
      offices: offices.length,
      users: users.length,
      inquiries: {
        total: inquiries.length,
        unread: inquiries.filter((item) => !item.read).length,
        latest: inquiries.slice(0, 5)
      },
      recentPages: [...routable]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map((page) => ({
          id: page.id,
          title: page.title,
          url: page.url,
          updatedAt: page.updatedAt,
          editUrl: page.kind === 'blog' || blogIds.has(page.parentId ?? 0) ? `/admin/blog/${page.id}/edit` : `/admin/pages/${page.id}/edit`
        }))
    };
  }
}

export const dashboardService = new DashboardService();
