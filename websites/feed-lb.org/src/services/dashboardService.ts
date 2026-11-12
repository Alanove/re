import type { Submission } from '../domain/models.js';
import { contactService } from './contactService.js';
import { officesService } from './officesService.js';
import { partnersService } from './partnersService.js';
import { pagesService } from './pagesService.js';
import { usersService } from './usersService.js';

export interface DashboardSummary {
  pages: { total: number; published: number; drafts: number };
  galleryImages: number;
  news: number;
  partners: number;
  donations: { total: number; unread: number };
  offices: number;
  users: number;
  inquiries: { total: number; unread: number; latest: Submission[] };
  recentPages: { id: number; title: string; url: string; updatedAt: string; editUrl: string }[];
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [pages, imageCounts, offices, users, inquiries, partners, news] = await Promise.all([
      pagesService.getFlatList(),
      pagesService.getImageCounts(),
      officesService.list(),
      usersService.list(),
      contactService.list(),
      partnersService.list(),
      pagesService.getCollectionOverview()
    ]);
    const routable = pages.filter((page) => page.kind !== 'footer');
    const donations = inquiries.filter((item) => item.type === 'donation');
    return {
      pages: {
        total: routable.length,
        published: routable.filter((page) => page.status === 'published').length,
        drafts: routable.filter((page) => page.status === 'draft').length
      },
      galleryImages: [...imageCounts.values()].reduce((sum, count) => sum + count, 0),
      news: news.entries.length,
      partners: partners.length,
      donations: { total: donations.length, unread: donations.filter((item) => !item.read).length },
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
          editUrl: pagesService.isNewsStory(page, pages) ? `/admin/news/${page.id}/edit` : `/admin/pages/${page.id}/edit`
        }))
    };
  }
}

export const dashboardService = new DashboardService();
