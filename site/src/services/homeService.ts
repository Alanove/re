import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export interface HomeUploads {
  image: string | null;
  slides: { image: string | null; video: string | null }[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero Slider',
  about: 'Who We Are',
  values: 'Values & Beliefs',
  solar: 'Solar & Energy',
  activities: 'Fields of Activity',
  presence: 'Regional Presence',
  contact: 'Contact'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function slideMedia(home: Home): Set<string> {
  return new Set(home.hero.slides.flatMap((slide) => [slide.image, slide.video]).filter(Boolean));
}

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    if (key === 'hero') {
      const count = home.hero.slides.length;
      return count === 0 ? 'No slides' : `${home.hero.slides[0]?.title ?? ''} (${count} slide${count === 1 ? '' : 's'})`;
    }
    return home[key].title;
  }

  public async updateSection<K extends HomeSectionKey>(key: K, input: SectionInput<K>, uploads: HomeUploads): Promise<Home> {
    const home = await homeRepository.get();
    const next: Home = { ...home, updatedAt: new Date().toISOString() };
    const uploadedImage = uploads.image;
    switch (key) {
      case 'hero': {
        const value = input as SectionInput<'hero'>;
        next.hero = {
          enabled: value.enabled,
          slides: value.slides.map((slide, index) => {
            const upload = uploads.slides[index];
            return {
              title: slide.title,
              text: slide.text,
              image: upload?.image ?? slide.image,
              video: upload?.video ?? (slide.removeVideo ? '' : slide.video),
              zoom: slide.zoom,
              primaryCta: { label: slide.primaryLabel, url: slide.primaryUrl },
              secondaryCta: { label: slide.secondaryLabel, url: slide.secondaryUrl }
            };
          })
        };
        break;
      }
      case 'about': {
        const value = input as SectionInput<'about'>;
        next.about = {
          enabled: value.enabled,
          title: value.title,
          lead: value.lead,
          text: value.text,
          image: uploadedImage ?? value.image,
          statValue: value.statValue,
          statLabel: value.statLabel,
          cta: { label: value.ctaLabel, url: value.ctaUrl }
        };
        break;
      }
      case 'values': {
        const value = input as SectionInput<'values'>;
        next.values = { enabled: value.enabled, title: value.title, intro: value.intro, items: value.items };
        break;
      }
      case 'solar': {
        const value = input as SectionInput<'solar'>;
        next.solar = {
          enabled: value.enabled,
          title: value.title,
          text: value.text,
          image: uploadedImage ?? value.image,
          cards: value.cards,
          listTitle: value.listTitle,
          list: value.list,
          cta: { label: value.ctaLabel, url: value.ctaUrl }
        };
        break;
      }
      case 'activities': {
        const value = input as SectionInput<'activities'>;
        next.activities = { enabled: value.enabled, title: value.title, intro: value.intro, items: value.items };
        break;
      }
      case 'presence': {
        const value = input as SectionInput<'presence'>;
        next.presence = { enabled: value.enabled, title: value.title, intro: value.intro, image: uploadedImage ?? value.image };
        break;
      }
      case 'contact': {
        const value = input as SectionInput<'contact'>;
        next.contact = { enabled: value.enabled, title: value.title, intro: value.intro };
        break;
      }
    }
    const saved = await homeRepository.save(next);
    if (key === 'hero') {
      const serialized = JSON.stringify(saved);
      for (const url of slideMedia(home)) {
        if (isOwnedUpload(url) && !serialized.includes(JSON.stringify(url))) {
          await mediaRepository.remove(url);
        }
      }
    }
    return saved;
  }
}

export const homeService = new HomeService();
