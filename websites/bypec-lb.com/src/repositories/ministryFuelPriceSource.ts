import { env } from '../config/env.js';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;
/** The ministry's Mod_Security rejects requests without browser-like Accept headers. */
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BypecPriceSync/1.0; +https://bypec-lb.com)',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ar,en;q=0.8'
};

export class FuelPriceSourceError extends Error {}

/** Reads the public Ministry of Energy and Water page that carries the official fuel price widget. */
export class MinistryFuelPriceSource {
  public constructor(private readonly url: string) {}

  public get sourceUrl(): string {
    return this.url;
  }

  public async fetchHtml(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.url, { headers: REQUEST_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error && error.name === 'TimeoutError' ? `no answer within ${REQUEST_TIMEOUT_MS / 1000} s` : error instanceof Error ? error.message : String(error);
      throw new FuelPriceSourceError(`The ministry website could not be reached (${reason}).`);
    }
    if (!response.ok) {
      throw new FuelPriceSourceError(`The ministry website answered with HTTP ${response.status}.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      throw new FuelPriceSourceError(`The ministry website returned "${contentType || 'no content type'}" instead of a web page.`);
    }
    return this.readLimited(response);
  }

  private async readLimited(response: Response): Promise<string> {
    if (!response.body) {
      throw new FuelPriceSourceError('The ministry website returned an empty page.');
    }
    const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new FuelPriceSourceError('The ministry page is larger than expected and was not read.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

export const ministryFuelPriceSource = new MinistryFuelPriceSource(env.FUEL_PRICES_SOURCE_URL);
