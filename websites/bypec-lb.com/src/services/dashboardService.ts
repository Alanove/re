import type { Submission } from '../domain/models.js';
import { contactService } from './contactService.js';
import { fuelPriceService, type FuelPriceStatus } from './fuelPriceService.js';
import { officesService } from './officesService.js';
import { pagesService } from './pagesService.js';
import { usersService } from './usersService.js';

export interface DashboardSummary {
  pages: { total: number; published: number; drafts: number };
  galleryImages: number;
  fuelPrices: FuelPriceStatus;
  offices: number;
  users: number;
  inquiries: { total: number; unread: number; latest: Submission[] };
  recentPages: { id: number; title: string; url: string; updatedAt: string; editUrl: string }[];
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [pages, imageCounts, offices, users, inquiries, fuelPrices] = await Promise.all([
      pagesService.getFlatList(),
      pagesService.getImageCounts(),
      officesService.list(),
      usersService.list(),
      contactService.list(),
      fuelPriceService.status()
    ]);
    const routable = pages.filter((page) => page.kind !== 'footer');
    return {
      pages: {
        total: routable.length,
        published: routable.filter((page) => page.status === 'published').length,
        drafts: routable.filter((page) => page.status === 'draft').length
      },
      galleryImages: [...imageCounts.values()].reduce((sum, count) => sum + count, 0),
      fuelPrices,
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
          editUrl: `/admin/pages/${page.id}/edit`
        }))
    };
  }
}

export const dashboardService = new DashboardService();
