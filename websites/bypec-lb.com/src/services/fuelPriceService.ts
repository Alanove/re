import { env } from '../config/env.js';
import { FUEL_PRICE_HISTORY_MAX, type FuelPriceDecision, type FuelPrices, type FuelProduct, type FuelProductKey } from '../domain/models.js';
import { BadRequestError } from '../errors/httpError.js';
import { ministryFuelPriceSource, type MinistryFuelPriceSource } from '../repositories/ministryFuelPriceSource.js';
import { fuelPricesRepository, type FuelPricesRepository } from '../repositories/singletonRepositories.js';
import { parseMinistryFuelPrices } from './fuelPriceParser.js';

const MAX_ERROR_LENGTH = 500;
const BOOT_DELAY_MS = 10_000;

export interface FuelPriceDisplayItem {
  key: FuelProductKey;
  label: string;
  price: number;
  formatted: string;
  adjusted: boolean;
}

export interface FuelPriceDisplay {
  show: boolean;
  unit: string;
  officialDate: string | null;
  officialDateLabel: string;
  items: FuelPriceDisplayItem[];
}

export interface FuelPriceStatus {
  healthy: boolean;
  syncEnabled: boolean;
  schedulerEnabled: boolean;
  intervalMinutes: number;
  sourceUrl: string;
  officialDateLabel: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangeAt: string | null;
  lastError: string;
  summary: string;
}

export interface FuelPriceSyncResult {
  ok: boolean;
  changed: boolean;
  message: string;
}

export interface FuelProductSettingsInput {
  key: FuelProductKey;
  label: string;
  override: number | null;
  visible: boolean;
  sort: number;
}

export interface FuelPriceSettingsInput {
  syncEnabled: boolean;
  unit: string;
  products: FuelProductSettingsInput[];
}

const priceFormat = new Intl.NumberFormat('en-US');
const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatOfficialDate(isoDate: string | null): string {
  return isoDate ? dateFormat.format(new Date(`${isoDate}T00:00:00Z`)) : '';
}

function relativeTime(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / 24)} days ago`;
}

function effectivePrice(product: FuelProduct): number | null {
  return product.override ?? product.officialPrice;
}

function samePrices(a: FuelPriceDecision['prices'], b: FuelPriceDecision['prices']): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as FuelProductKey[]);
  return [...keys].every((key) => a[key] === b[key]);
}

export class FuelPriceService {
  private running: Promise<FuelPriceSyncResult> | null = null;

  public constructor(
    private readonly repository: FuelPricesRepository,
    private readonly source: MinistryFuelPriceSource
  ) {}

  public async getDisplay(): Promise<FuelPriceDisplay> {
    const prices = await this.repository.get();
    const items = prices.products
      .filter((product) => product.visible)
      .sort((a, b) => a.sort - b.sort)
      .flatMap((product): FuelPriceDisplayItem[] => {
        const price = effectivePrice(product);
        return price === null ? [] : [{ key: product.key, label: product.label, price, formatted: priceFormat.format(price), adjusted: product.override !== null }];
      });
    return {
      show: items.length > 0,
      unit: prices.unit,
      officialDate: prices.sync.officialDate,
      officialDateLabel: formatOfficialDate(prices.sync.officialDate),
      items
    };
  }

  public async getSettings(): Promise<FuelPrices> {
    const prices = await this.repository.get();
    return { ...prices, products: [...prices.products].sort((a, b) => a.sort - b.sort) };
  }

  public async status(now = new Date()): Promise<FuelPriceStatus> {
    const { sync } = await this.repository.get();
    const healthy = sync.lastError === '' && (sync.lastSuccessAt !== null || !sync.enabled || !env.FUEL_PRICES_SYNC_ENABLED);
    let summary: string;
    if (!env.FUEL_PRICES_SYNC_ENABLED) {
      summary = 'Automatic sync is switched off on this server';
    } else if (!sync.enabled) {
      summary = 'Automatic sync is paused';
    } else if (sync.lastError) {
      summary = `Last sync failed ${sync.lastAttemptAt ? relativeTime(sync.lastAttemptAt, now) : ''}`.trim();
    } else if (sync.lastSuccessAt) {
      summary = `Checked the ministry ${relativeTime(sync.lastSuccessAt, now)}`;
    } else {
      summary = 'Waiting for the first sync';
    }
    return {
      healthy,
      syncEnabled: sync.enabled,
      schedulerEnabled: env.FUEL_PRICES_SYNC_ENABLED,
      intervalMinutes: env.FUEL_PRICES_SYNC_MINUTES,
      sourceUrl: this.source.sourceUrl,
      officialDateLabel: formatOfficialDate(sync.officialDate),
      lastAttemptAt: sync.lastAttemptAt,
      lastSuccessAt: sync.lastSuccessAt,
      lastChangeAt: sync.lastChangeAt,
      lastError: sync.lastError,
      summary
    };
  }

  public async updateSettings(input: FuelPriceSettingsInput): Promise<FuelPrices> {
    const keys = new Set(input.products.map((product) => product.key));
    if (keys.size !== input.products.length) {
      throw new BadRequestError('Each fuel product can only appear once.');
    }
    const now = new Date().toISOString();
    return this.repository.update((current) => {
      const byKey = new Map(input.products.map((product) => [product.key, product]));
      const products = current.products.map((product) => {
        const change = byKey.get(product.key);
        if (!change) {
          return product;
        }
        return {
          ...product,
          label: change.label,
          override: change.override,
          overrideUpdatedAt: change.override === product.override ? product.overrideUpdatedAt : change.override === null ? null : now,
          visible: change.visible,
          sort: change.sort
        };
      });
      return { ...current, unit: input.unit, sync: { ...current.sync, enabled: input.syncEnabled }, products, updatedAt: now };
    });
  }

  /** Runs one sync. Concurrent callers share the run in progress instead of hitting the ministry twice. */
  public syncNow(): Promise<FuelPriceSyncResult> {
    this.running ??= this.runSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Starts the background schedule and returns a function that stops it. Does nothing when the server switch is off. */
  public startScheduler(): () => void {
    if (!env.FUEL_PRICES_SYNC_ENABLED) {
      console.info('Fuel price sync: switched off by FUEL_PRICES_SYNC_ENABLED');
      return () => undefined;
    }
    const tick = async (): Promise<void> => {
      try {
        const { sync } = await this.repository.get();
        if (!sync.enabled) {
          return;
        }
        const result = await this.syncNow();
        if (!result.ok) {
          console.warn(`Fuel price sync: ${result.message}`);
        }
      } catch (error) {
        console.error('Fuel price sync crashed', error);
      }
    };
    const first = setTimeout(() => void tick(), BOOT_DELAY_MS);
    const interval = setInterval(() => void tick(), env.FUEL_PRICES_SYNC_MINUTES * 60_000);
    first.unref();
    interval.unref();
    console.info(`Fuel price sync: every ${env.FUEL_PRICES_SYNC_MINUTES} min from ${this.source.sourceUrl}`);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }

  private async runSync(): Promise<FuelPriceSyncResult> {
    const attemptAt = new Date().toISOString();
    let decision: FuelPriceDecision;
    try {
      const html = await this.source.fetchHtml();
      const parsed = parseMinistryFuelPrices(html);
      decision = { officialDate: parsed.officialDate, fetchedAt: attemptAt, prices: parsed.prices };
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
      await this.repository.update((current) => ({ ...current, sync: { ...current.sync, lastAttemptAt: attemptAt, lastError: message } }));
      return { ok: false, changed: false, message: `${message} The last known prices are still shown.` };
    }

    const saved = await this.repository.update((current) => {
      const previous = current.history.at(-1);
      const changed = !previous || previous.officialDate !== decision.officialDate || !samePrices(previous.prices, decision.prices);
      const products = current.products.map((product) => ({ ...product, officialPrice: decision.prices[product.key] ?? null }));
      return {
        ...current,
        products,
        sync: {
          ...current.sync,
          officialDate: decision.officialDate,
          lastAttemptAt: attemptAt,
          lastSuccessAt: attemptAt,
          lastChangeAt: changed ? attemptAt : current.sync.lastChangeAt,
          lastError: ''
        },
        history: changed ? [...current.history, decision].slice(-FUEL_PRICE_HISTORY_MAX) : current.history,
        updatedAt: changed ? attemptAt : current.updatedAt
      };
    });
    const changed = saved.sync.lastChangeAt === attemptAt;
    const dateText = formatOfficialDate(decision.officialDate);
    return {
      ok: true,
      changed,
      message: changed
        ? `New official prices${dateText ? ` dated ${dateText}` : ''} were saved.`
        : `Prices are up to date${dateText ? ` (official date ${dateText})` : ''}.`
    };
  }
}

export const fuelPriceService = new FuelPriceService(fuelPricesRepository, ministryFuelPriceSource);
