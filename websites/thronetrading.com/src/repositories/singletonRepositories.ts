import { DATA_FILES } from '../config/paths.js';
import { defaultHome, defaultSettings } from '../domain/defaults.js';
import { homeSchema, settingsSchema, type Home, type Settings } from '../domain/models.js';
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

export const homeRepository = new HomeRepository();
export const settingsRepository = new SettingsRepository();
