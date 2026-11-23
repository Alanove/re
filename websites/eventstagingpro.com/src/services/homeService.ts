import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';
import { sanitizeRichText } from './sanitizeService.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export interface HomeUploads {
  image: string | null;
  rowImages: (string | null)[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero Slider',
  about: 'About',
  latestPosts: 'Latest Posts',
  gallery: 'Media Gallery'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const urls = [...home.hero.slides.map((slide) => slide.image), home.about.image];
  return new Set(urls.filter(Boolean));
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
    if (key === 'latestPosts') {
      return home.latestPosts.title || 'Latest Posts';
    }
    if (key === 'gallery') {
      return home.gallery.title || 'Media Gallery';
    }
    return home.about.title || 'About';
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
    } else if (key === 'about') {
      const value = input as SectionInput<'about'>;
      next.about = {
        enabled: value.enabled,
        title: value.title,
        content: sanitizeRichText(value.content),
        image: uploads.image ?? value.image
      };
    } else if (key === 'latestPosts') {
      const value = input as SectionInput<'latestPosts'>;
      next.latestPosts = { enabled: value.enabled, title: value.title, intro: value.intro, limit: value.limit };
    } else if (key === 'gallery') {
      const value = input as SectionInput<'gallery'>;
      next.gallery = { enabled: value.enabled, title: value.title, intro: value.intro };
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
