import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { categoriesRepository } from '../repositories/catalogRepositories.js';
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
  categories: 'Product Categories',
  brands: 'Our Brands',
  featuredProducts: 'Featured Products',
  whyUs: 'Why Choose Us',
  contact: 'Contact'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const urls = [...home.hero.slides.flatMap((slide) => [slide.image, slide.video]), home.about.image, home.whyUs.image];
  return new Set(urls.filter(Boolean));
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
      case 'categories': {
        const value = input as SectionInput<'categories'>;
        const known = new Set((await categoriesRepository.findAll()).map((category) => category.id));
        next.categories = { enabled: value.enabled, title: value.title, intro: value.intro, categoryIds: value.categoryIds.filter((id) => known.has(id)) };
        break;
      }
      case 'brands': {
        const value = input as SectionInput<'brands'>;
        next.brands = { enabled: value.enabled, title: value.title, intro: value.intro };
        break;
      }
      case 'featuredProducts': {
        const value = input as SectionInput<'featuredProducts'>;
        next.featuredProducts = {
          enabled: value.enabled,
          title: value.title,
          intro: value.intro,
          limit: value.limit,
          cta: { label: value.ctaLabel, url: value.ctaUrl }
        };
        break;
      }
      case 'whyUs': {
        const value = input as SectionInput<'whyUs'>;
        next.whyUs = { enabled: value.enabled, title: value.title, intro: value.intro, image: uploadedImage ?? value.image, items: value.items };
        break;
      }
      case 'contact': {
        const value = input as SectionInput<'contact'>;
        next.contact = { enabled: value.enabled, title: value.title, intro: value.intro };
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
