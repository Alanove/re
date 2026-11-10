import { DATA_FILES } from '../config/paths.js';
import { defaultHome, defaultSettings, defaultSocial, defaultVideoLibrary } from '../domain/defaults.js';
import {
  homeSchema,
  settingsSchema,
  socialSchema,
  videoLibrarySchema,
  type Home,
  type Settings,
  type Social,
  type VideoLibrary
} from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class HomeRepository {
  private readonly store = new JsonFileStore<Home>(DATA_FILES.home, homeSchema, defaultHome);

  public async get(): Promise<Home> {
    return this.store.read();
  }

  public async save(home: Home): Promise<Home> {
    await this.store.write(home);
    return home;
  }
}

export class SettingsRepository {
  private readonly store = new JsonFileStore<Settings>(DATA_FILES.settings, settingsSchema, defaultSettings);

  public async get(): Promise<Settings> {
    return this.store.read();
  }

  public async save(settings: Settings): Promise<Settings> {
    await this.store.write(settings);
    return settings;
  }
}

export class SocialRepository {
  private readonly store = new JsonFileStore<Social>(DATA_FILES.social, socialSchema, defaultSocial);

  public async get(): Promise<Social> {
    return this.store.read();
  }

  public async update(mutator: (social: Social) => Social): Promise<Social> {
    return this.store.update((current) => {
      const next = mutator(current);
      return { next, result: next };
    });
  }
}

export class VideoLibraryRepository {
  private readonly store = new JsonFileStore<VideoLibrary>(DATA_FILES.videos, videoLibrarySchema, defaultVideoLibrary);

  public async get(): Promise<VideoLibrary> {
    return this.store.read();
  }

  /** Read-modify-write under the store's queue, so a scheduled sync and an admin save never overwrite each other. */
  public async update(mutator: (library: VideoLibrary) => VideoLibrary): Promise<VideoLibrary> {
    return this.store.update((current) => {
      const next = mutator(current);
      return { next, result: next };
    });
  }
}

export const homeRepository = new HomeRepository();
export const settingsRepository = new SettingsRepository();
export const socialRepository = new SocialRepository();
export const videoLibraryRepository = new VideoLibraryRepository();
