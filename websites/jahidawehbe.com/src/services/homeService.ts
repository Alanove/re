import type { z } from 'zod';
import type { HeroSlide, Home, HomeSectionKey } from '../domain/models.js';
import { BadRequestError } from '../errors/httpError.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';
import { sanitizeRichText } from './sanitizeService.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

/** Newly stored files; `slides` lines up with the submitted slide rows. */
export interface HomeUploads {
  image: string | null;
  slides: { image: string | null; video: string | null }[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero slider',
  upcoming: 'Upcoming Events',
  videos: 'Latest Videos',
  about: 'About',
  quotes: 'Quotes',
  events: 'Past Performances',
  news: 'News'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const slideMedia = home.hero.slides.flatMap((slide) => [slide.image, slide.video]);
  return new Set([...slideMedia, home.about.image, home.quotes.image].filter(Boolean));
}

function buildSlides(input: SectionInput<'hero'>['slides'], uploads: HomeUploads['slides']): HeroSlide[] {
  const slides = input.map((slide, index) => ({
    image: uploads[index]?.image ?? slide.image,
    video: uploads[index]?.video ?? slide.video,
    focus: slide.focus,
    caption: slide.caption
  }));
  const fields = Object.fromEntries(
    slides.flatMap((slide, index) => (slide.image === '' && slide.video === '' ? [[`slides.${index}.image`, 'Choose a photo or a video for this slide, or remove the slide']] : []))
  );
  if (Object.keys(fields).length > 0) {
    throw new BadRequestError('Please correct the highlighted fields.', fields);
  }
  return slides;
}

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    switch (key) {
      case 'hero': {
        const count = home.hero.slides.length;
        return `${home.hero.title || 'No heading'} (${count} slide${count === 1 ? '' : 's'})`;
      }
      case 'quotes': {
        const count = home.quotes.items.length;
        return `${home.quotes.title || 'Quotes'} (${count} quote${count === 1 ? '' : 's'})`;
      }
      case 'upcoming':
      case 'videos':
      case 'events':
      case 'news':
        return `${home[key].title} (up to ${home[key].count})`;
      default:
        return home[key].title;
    }
  }

  public async updateSection<K extends HomeSectionKey>(key: K, input: SectionInput<K>, uploads: HomeUploads): Promise<Home> {
    const home = await homeRepository.get();
    const next: Home = { ...home, updatedAt: new Date().toISOString() };
    switch (key) {
      case 'hero': {
        const value = input as SectionInput<'hero'>;
        next.hero = {
          enabled: value.enabled,
          eyebrow: value.eyebrow,
          title: value.title,
          intro: value.intro,
          textSide: value.textSide,
          interval: value.interval,
          slides: buildSlides(value.slides, uploads.slides),
          cta: { label: value.ctaLabel, url: value.ctaUrl }
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
      case 'quotes': {
        const value = input as SectionInput<'quotes'>;
        next.quotes = { enabled: value.enabled, title: value.title, image: uploads.image ?? value.image, items: value.items };
        break;
      }
      case 'upcoming':
      case 'videos':
      case 'events':
      case 'news': {
        const value = input as SectionInput<'videos'>;
        const listKey: 'upcoming' | 'videos' | 'events' | 'news' = key;
        next[listKey] = { enabled: value.enabled, title: value.title, intro: value.intro, count: value.count };
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
