import type { Submission } from '../domain/models.js';
import { articlesRepository } from '../repositories/articlesRepository.js';
import { albumsRepository, booksRepository, hymnsRepository, videosRepository } from '../repositories/contentRepositories.js';
import { subscribersRepository } from '../repositories/subscribersRepository.js';
import { articleUrl } from './articlesService.js';
import { contactService } from './contactService.js';
import { pagesService } from './pagesService.js';
import { sectionsService } from './sectionsService.js';
import { usersService } from './usersService.js';

export interface DashboardSummary {
  articles: { total: number; published: number; drafts: number };
  sections: number;
  pages: number;
  books: number;
  hymns: number;
  albums: number;
  videos: number;
  subscribers: number;
  users: number;
  inquiries: { total: number; unread: number; latest: Submission[] };
  recentArticles: { id: number; title: string; url: string; sectionTitle: string; updatedAt: string }[];
}

export class DashboardService {
  public async summary(): Promise<DashboardSummary> {
    const [articles, sections, pages, books, hymns, albums, videos, subscribers, users, inquiries] = await Promise.all([
      articlesRepository.snapshot(),
      sectionsService.byId(),
      pagesService.getFlatList(),
      booksRepository.findAll(),
      hymnsRepository.findAll(),
      albumsRepository.findAll(),
      videosRepository.findAll(),
      subscribersRepository.findAll(),
      usersService.list(),
      contactService.list()
    ]);
    return {
      articles: {
        total: articles.length,
        published: articles.filter((article) => article.status === 'published').length,
        drafts: articles.filter((article) => article.status === 'draft').length
      },
      sections: sections.size,
      pages: pages.length,
      books: books.length,
      hymns: hymns.length,
      albums: albums.length,
      videos: videos.length,
      subscribers: subscribers.length,
      users: users.length,
      inquiries: {
        total: inquiries.length,
        unread: inquiries.filter((item) => !item.read).length,
        latest: inquiries.slice(0, 5)
      },
      recentArticles: [...articles]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8)
        .map((article) => {
          const section = sections.get(article.sectionId);
          return { id: article.id, title: article.title, url: section ? articleUrl(article, section) : '', sectionTitle: section?.title ?? '', updatedAt: article.updatedAt };
        })
    };
  }
}

export const dashboardService = new DashboardService();
