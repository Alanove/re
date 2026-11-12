import type { z } from 'zod';
import type { Home, HomeSectionKey } from '../domain/models.js';
import { homeRepository } from '../repositories/singletonRepositories.js';
import type { homeSectionSchemas } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';

type SectionInput<K extends HomeSectionKey> = z.infer<(typeof homeSectionSchemas)[K]>;

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  spotlight: 'Spotlight (lead stories)',
  sections: 'Sections grid',
  questions: 'Ask the priest',
  hymns: 'Hymns',
  videos: 'Videos',
  albums: 'Photo albums',
  newsletter: 'Newsletter sign-up'
};

export class HomeService {
  public async get(): Promise<Home> {
    return homeRepository.get();
  }

  public sectionTitle(home: Home, key: HomeSectionKey): string {
    return home[key].title;
  }

  public async updateSection<K extends HomeSectionKey>(key: K, input: SectionInput<K>): Promise<Home> {
    const home = await homeRepository.get();
    const saved = await homeRepository.save({ ...home, [key]: { ...input }, updatedAt: new Date().toISOString() });
    contentEvents.changed('home');
    return saved;
  }
}

export const homeService = new HomeService();
