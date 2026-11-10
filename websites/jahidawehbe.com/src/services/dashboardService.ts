import { isUpcoming } from './collectionService.js';
import { pagesService } from './pagesService.js';
import { socialService } from './socialService.js';
import { usersService } from './usersService.js';
import { videoService, type VideoSyncStatus } from './videoService.js';

export interface DashboardSummary {
  pages: { total: number; published: number; drafts: number };
  news: number;
  events: { total: number; upcoming: number };
  videos: { total: number; visible: number; status: VideoSyncStatus };
  social: { profiles: number; instagramPosts: number; facebookTimeline: boolean };
  users: number;
  recentPages: { id: number; title: string; url: string; updatedAt: string; editUrl: string }[];
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [pages, news, events, library, status, social, users] = await Promise.all([
      pagesService.getFlatList(),
      pagesService.getCollectionOverview('news'),
      pagesService.getCollectionOverview('events'),
      videoService.getLibrary(),
      videoService.status(),
      socialService.get(),
      usersService.list()
    ]);
    const newsIds = new Set(news.entries.map((page) => page.id));
    const eventIds = new Set(events.entries.map((page) => page.id));
    const editUrl = (id: number): string => (newsIds.has(id) ? `/admin/news/${id}/edit` : eventIds.has(id) ? `/admin/events/${id}/edit` : `/admin/pages/${id}/edit`);
    return {
      pages: {
        total: pages.length,
        published: pages.filter((page) => page.status === 'published').length,
        drafts: pages.filter((page) => page.status === 'draft').length
      },
      news: news.entries.length,
      events: { total: events.entries.length, upcoming: events.entries.filter((page) => page.status === 'published' && isUpcoming(page)).length },
      videos: { total: library.items.length, visible: library.items.filter((item) => !item.hidden).length, status },
      social: {
        profiles: socialService.links(social).length,
        instagramPosts: social.instagram.posts.length,
        facebookTimeline: socialService.facebookTimeline(social) !== ''
      },
      users: users.length,
      recentPages: [...pages]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map((page) => ({ id: page.id, title: page.title, url: page.url, updatedAt: page.updatedAt, editUrl: editUrl(page.id) }))
    };
  }
}

export const dashboardService = new DashboardService();
