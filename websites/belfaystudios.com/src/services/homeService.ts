import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';
import { sanitizeRichText } from './sanitizeService.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export interface HomeUploads {
  image: string | null;
  memberPhotos: (string | null)[];
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero & Slogans',
  about: 'Who We Are',
  studios: 'Our Studios',
  services: 'Our Services',
  team: 'Team & Talents',
  latestPosts: 'Latest Posts',
  contact: 'Contact'
};

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

function ownedMedia(home: Home): Set<string> {
  const urls = [home.hero.image, home.studios.image, home.contact.image, ...home.team.members.map((member) => member.photo)];
  return new Set(urls.filter(Boolean));
}

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    if (key === 'hero') {
      const count = home.hero.slogans.length;
      return count === 0 ? 'No slogans' : `${home.hero.slogans[0] ?? ''} (${count} slogan${count === 1 ? '' : 's'})`;
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
          eyebrow: value.eyebrow,
          slogans: value.slogans,
          image: uploadedImage ?? value.image,
          primaryCta: { label: value.primaryLabel, url: value.primaryUrl },
          secondaryCta: { label: value.secondaryLabel, url: value.secondaryUrl }
        };
        break;
      }
      case 'about': {
        const value = input as SectionInput<'about'>;
        next.about = {
          enabled: value.enabled,
          title: value.title,
          content: sanitizeRichText(value.content),
          highlight: value.highlight,
          statValue: value.statValue,
          statLabel: value.statLabel
        };
        break;
      }
      case 'studios': {
        const value = input as SectionInput<'studios'>;
        next.studios = {
          enabled: value.enabled,
          title: value.title,
          content: sanitizeRichText(value.content),
          quote: value.quote,
          image: uploadedImage ?? value.image
        };
        break;
      }
      case 'services': {
        const value = input as SectionInput<'services'>;
        next.services = { enabled: value.enabled, title: value.title, intro: value.intro, items: value.items };
        break;
      }
      case 'team': {
        const value = input as SectionInput<'team'>;
        next.team = {
          enabled: value.enabled,
          title: value.title,
          content: sanitizeRichText(value.content),
          members: value.members.map((member, index) => ({
            name: member.name,
            role: member.role,
            photo: uploads.memberPhotos[index] ?? member.photo,
            bio: member.bio
          }))
        };
        break;
      }
      case 'latestPosts': {
        const value = input as SectionInput<'latestPosts'>;
        next.latestPosts = { enabled: value.enabled, title: value.title, intro: value.intro, limit: value.limit };
        break;
      }
      case 'contact': {
        const value = input as SectionInput<'contact'>;
        next.contact = { enabled: value.enabled, title: value.title, intro: value.intro, image: uploadedImage ?? value.image };
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
