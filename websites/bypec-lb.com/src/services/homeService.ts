import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';
import { sanitizeRichText } from './sanitizeService.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export interface HomeUploads {
  image: string | null;
  video: string | null;
  /** One entry per kept repeater row (tiles, testimonial photos or service images), null when no new file was chosen. */
  rowImages: (string | null)[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero & Station Tiles',
  about: 'About Us',
  prices: 'Fuel Prices',
  testimonials: 'Testimonials',
  services: 'Our Services'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const urls = [
    home.hero.image,
    ...home.hero.tiles.map((tile) => tile.image),
    home.about.image,
    home.testimonials.image,
    home.testimonials.video,
    ...home.testimonials.items.map((item) => item.photo),
    ...home.services.items.map((item) => item.image)
  ];
  return new Set(urls.filter(Boolean));
}

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    if (key === 'hero') {
      const count = home.hero.tiles.length;
      return `${home.hero.title || 'No heading'} (${count} station tile${count === 1 ? '' : 's'})`;
    }
    return home[key].title;
  }

  public async updateSection<K extends HomeSectionKey>(key: K, input: SectionInput<K>, uploads: HomeUploads): Promise<Home> {
    const home = await homeRepository.get();
    const next: Home = { ...home, updatedAt: new Date().toISOString() };
    const rowImage = (index: number, current: string): string => uploads.rowImages[index] ?? current;
    switch (key) {
      case 'hero': {
        const value = input as SectionInput<'hero'>;
        next.hero = {
          enabled: value.enabled,
          eyebrow: value.eyebrow,
          title: value.title,
          intro: value.intro,
          image: uploads.image ?? value.image,
          tiles: value.tiles.map((tile, index) => ({ title: tile.title, url: tile.url, image: rowImage(index, tile.image) }))
        };
        break;
      }
      case 'about': {
        const value = input as SectionInput<'about'>;
        next.about = {
          enabled: value.enabled,
          title: value.title,
          heading: value.heading,
          content: sanitizeRichText(value.content),
          image: uploads.image ?? value.image,
          cta: { label: value.ctaLabel, url: value.ctaUrl }
        };
        break;
      }
      case 'prices': {
        const value = input as SectionInput<'prices'>;
        next.prices = { enabled: value.enabled, title: value.title, intro: value.intro };
        break;
      }
      case 'testimonials': {
        const value = input as SectionInput<'testimonials'>;
        next.testimonials = {
          enabled: value.enabled,
          title: value.title,
          image: uploads.image ?? value.image,
          video: uploads.video ?? value.video,
          items: value.items.map((item, index) => ({ name: item.name, role: item.role, quote: item.quote, photo: rowImage(index, item.photo) }))
        };
        break;
      }
      case 'services': {
        const value = input as SectionInput<'services'>;
        next.services = {
          enabled: value.enabled,
          title: value.title,
          intro: value.intro,
          items: value.items.map((item, index) => ({ title: item.title, text: item.text, url: item.url, image: rowImage(index, item.image) }))
        };
        break;
      }
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
