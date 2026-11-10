import { DATA_FILES } from '../config/paths.js';
import { defaultFuelPrices, defaultHome, defaultSettings } from '../domain/defaults.js';
import { fuelPricesSchema, homeSchema, settingsSchema, type FuelPrices, type Home, type Settings } from '../domain/models.js';
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

export class FuelPricesRepository {
  private readonly store = new JsonFileStore<FuelPrices>(DATA_FILES.fuelPrices, fuelPricesSchema, defaultFuelPrices);

  public async get(): Promise<FuelPrices> {
    return this.store.read();
  }

  /** Read-modify-write under the store's queue, so a scheduled sync and an admin save never overwrite each other. */
  public async update(mutator: (prices: FuelPrices) => FuelPrices): Promise<FuelPrices> {
    return this.store.update((current) => {
      const next = mutator(current);
      return { next, result: next };
    });
  }
}

export const homeRepository = new HomeRepository();
export const fuelPricesRepository = new FuelPricesRepository();
export const settingsRepository = new SettingsRepository();
