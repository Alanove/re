import type { z } from 'zod';
import { homeListSectionKeys, type Home, type HomeListSectionKey, type HomeSectionKey } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export interface HomeUploads {
  image: string | null;
  /** One entry per kept slide row, null when no new file was chosen. */
  rowImages: (string | null)[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero Slider',
  programs: 'Our Programs',
  about: 'About FEED',
  news: 'Latest News',
  team: 'Executive Team',
  partners: 'Partners',
  donate: 'Donate Banner'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const urls = [...home.hero.slides.map((slide) => slide.image), home.donate.image];
  return new Set(urls.filter(Boolean));
}

export function isHomeListSection(key: HomeSectionKey): key is HomeListSectionKey {
  return (homeListSectionKeys as readonly string[]).includes(key);
}

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    if (key === 'hero') {
      const count = home.hero.slides.length;
      return `${count} slide${count === 1 ? '' : 's'}, every ${home.hero.interval}s`;
    }
    return home[key].title;
  }

  public async updateSection<K extends HomeSectionKey>(key: K, input: SectionInput<K>, uploads: HomeUploads): Promise<Home> {
    const home = await homeRepository.get();
    const next: Home = { ...home, updatedAt: new Date().toISOString() };
    if (key === 'hero') {
      const value = input as SectionInput<'hero'>;
      next.hero = {
        enabled: value.enabled,
        interval: value.interval,
        slides: value.slides.map((slide, index) => ({ ...slide, image: uploads.rowImages[index] ?? slide.image }))
      };
    } else if (key === 'news') {
      next.news = { ...(input as SectionInput<'news'>) };
    } else if (key === 'partners') {
      next.partners = { ...(input as SectionInput<'partners'>) };
    } else if (key === 'donate') {
      const value = input as SectionInput<'donate'>;
      next.donate = { ...value, image: uploads.image ?? value.image };
    } else if (isHomeListSection(key)) {
      next[key] = { ...(input as SectionInput<HomeListSectionKey>) };
    }
    const saved = await homeRepository.save(next);
    const serialized = JSON.stringify(saved);
    for (const url of ownedMedia(home)) {
      if (isOwnedUpload(url) && !serialized.includes(JSON.stringify(url))) {
        await mediaRepository.remove(url);
      }
    }
    return saved;
  }
}

export const homeService = new HomeService();
