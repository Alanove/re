/**
 * Aramex JSON API client. All requests use ClientInfo from .env only (getClientInfo throws if missing).
 * No hardcoded credentials.
 */

import { XMLParser } from 'fast-xml-parser';
import { getClientInfo, type AramexClientInfo } from './clientInfo';

const TRANSACTION = {
  Reference1: '',
  Reference2: '',
  Reference3: '',
  Reference4: '',
  Reference5: ''
};

const LOCATION_BASE = process.env.ARAMEX_LOCATION_BASE_URL || 'https://ws.aramex.net/ShippingAPI.V2/Location/Service_1_0.svc/json';
const RATE_CALCULATOR_URL = process.env.ARAMEX_RATE_CALCULATOR_URL || 'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate';
const SHIPPING_BASE = process.env.ARAMEX_SHIPPING_BASE_URL || 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json';

/** Public URL for CreateShipments (for debug/display). */
export function getCreateShipmentsUrl(): string {
  return `${SHIPPING_BASE}/CreateShipments`;
}

const TRACKING_URL = process.env.ARAMEX_TRACKING_URL || 'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments';

async function postJson<T = unknown>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Aramex API ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export interface FetchCountriesResponse {
  HasErrors?: boolean;
  Notifications?: { Notification?: Array<{ Code?: string; Message?: string }> };
  Countries?: { Country?: Array<{ Code?: string; Name?: string }> };
}

export interface FetchCitiesResponse {
  HasErrors?: boolean;
  Notifications?: { Notification?: Array<{ Code?: string; Message?: string }> };
  /** API returns Cities as string[]; we normalize to { string: string[] }. */
  Cities?: { string?: string[] } | string[];
}

/** State item from API (dropdown: display Name, value Code). */
export interface StateItem {
  Code?: string;
  Name?: string;
}
export interface FetchStatesResponse {
  HasErrors?: boolean;
  Notifications?: { Notification?: Array<{ Code?: string; Message?: string }> };
  /** Either array of { Code, Name } (preferred for dropdowns) or legacy { string: string[] }. */
  States?: StateItem[] | { string?: string[] };
}

export interface CalculateRateResponse {
  HasErrors?: boolean;
  Notifications?: { Notification?: Array<{ Code?: string; Message?: string }> };
  TotalAmount?: { Value?: number; CurrencyCode?: string };
}

export interface CreateShipmentsResponse {
  HasErrors?: boolean;
  Notifications?: unknown;
  Shipments?: {
    ProcessedShipment?: Array<{
      ID?: string;
      Reference1?: string;
      ShipmentLabel?: { LabelURL?: string };
    }> | {
      ID?: string;
      Reference1?: string;
      ShipmentLabel?: { LabelURL?: string };
    };
  };
}

export interface TrackShipmentsResponse {
  HasErrors?: boolean;
  Notifications?: unknown;
  TrackingResults?: unknown;
}

export interface CreatePickupResponse {
  HasErrors?: boolean;
  Notifications?: unknown;
  ProcessedPickup?: { ID?: string; GUID?: string; Reference1?: string };
}

/** If the API returned XML, parse it into the same shape as JSON so callers get a consistent object. */
function normalizeFetchCountriesResponse(raw: unknown): FetchCountriesResponse {
  let out: FetchCountriesResponse;
  if (typeof raw === 'string' && raw.trim().startsWith('<')) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(raw) as Record<string, unknown>;
    const root = parsed.FetchCountriesResponse ?? parsed.Body ?? parsed;
    out = (root && typeof root === 'object' ? root : parsed) as FetchCountriesResponse;
  } else {
    out = (raw && typeof raw === 'object' ? raw : {}) as FetchCountriesResponse;
  }
  // API can return Countries as the array itself (numeric keys) or as { Country: [...] }; normalize to { Country: array }
  const c = out.Countries as Record<string, unknown> | undefined;
  if (c && !c.Country && (Array.isArray(c) || (typeof c === 'object' && Object.keys(c).some((k) => /^\d+$/.test(k))))) {
    const arr = Array.isArray(c) ? c : Object.keys(c)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => c[k]);
    out.Countries = { Country: arr as Array<{ Code?: string; Name?: string }> };
  } else if (c && c.Country != null && !Array.isArray(c.Country)) {
    (out.Countries as { Country: Array<{ Code?: string; Name?: string }> }).Country = [c.Country as { Code?: string; Name?: string }];
  }
  return out;
}

/**
 * Fetch countries from Aramex Location API.
 */
export async function fetchCountries(): Promise<FetchCountriesResponse> {
  const ClientInfo = getClientInfo();
  const raw = await postJson<FetchCountriesResponse | string>(`${LOCATION_BASE}/FetchCountries`, {
    ClientInfo,
    Transaction: TRANSACTION
  });
  return normalizeFetchCountriesResponse(raw);
}

/** Normalize FetchCities response so Cities.string is string[] (API returns Cities as string[]). */
function normalizeFetchCitiesResponse(raw: unknown): FetchCitiesResponse {
  let out: FetchCitiesResponse;
  if (typeof raw === 'string' && raw.trim().startsWith('<')) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(raw) as Record<string, unknown>;
    const root = parsed.FetchCitiesResponse ?? parsed.Body ?? parsed;
    out = (root && typeof root === 'object' ? root : parsed) as FetchCitiesResponse;
  } else {
    out = (raw && typeof raw === 'object' ? raw : {}) as FetchCitiesResponse;
  }
  const c = out.Cities;
  if (Array.isArray(c)) {
    const arr = c.filter((v): v is string => typeof v === 'string');
    out.Cities = { string: arr };
  } else if (c && typeof c === 'object' && !Array.isArray(c)) {
    const obj = c as Record<string, unknown>;
    if (obj.string == null && Object.keys(obj).some((k) => /^\d+$/.test(k))) {
      const arr = Object.keys(obj)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => obj[k])
        .filter((v): v is string => typeof v === 'string');
      out.Cities = { string: arr };
    } else if (obj.string != null && !Array.isArray(obj.string)) {
      out.Cities = { string: [obj.string as string] };
    }
  }
  return out;
}

/**
 * Fetch cities for a country. State is always sent empty (API returns null when state is provided for US).
 * nameStartsWith: optional search prefix; when provided, API returns cities whose name starts with this string.
 */
export async function fetchCities(countryCode: string, _state?: string, nameStartsWith?: string): Promise<FetchCitiesResponse> {
  const ClientInfo = getClientInfo();
  const raw = await postJson<FetchCitiesResponse | string>(`${LOCATION_BASE}/FetchCities`, {
    ClientInfo,
    CountryCode: countryCode.toUpperCase(),
    NameStartsWith: (nameStartsWith ?? '').trim(),
    State: '',
    Transaction: TRANSACTION
  });
  return normalizeFetchCitiesResponse(raw);
}

/** Normalize FetchStates response so States.string is always a string[] (handles XML and array-shaped States). */
function normalizeFetchStatesResponse(raw: unknown): FetchStatesResponse {
  let out: FetchStatesResponse;
  if (typeof raw === 'string' && raw.trim().startsWith('<')) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(raw) as Record<string, unknown>;
    const root = parsed.FetchStatesResponse ?? parsed.Body ?? parsed;
    out = (root && typeof root === 'object' ? root : parsed) as FetchStatesResponse;
  } else {
    out = (raw && typeof raw === 'object' ? raw : {}) as FetchStatesResponse;
  }
  const s = out.States as Record<string, unknown> | undefined;
  if (!s) return out;

  let arr: string[] = [];

  // States is the array itself: array of strings OR array of objects { Code, Name } (live API returns this)
  if (Array.isArray(s)) {
    const list = s as unknown[];
    const first = list[0];
    if (typeof first === 'string') {
      arr = list.filter((v): v is string => typeof v === 'string');
    } else if (first && typeof first === 'object' && !Array.isArray(first)) {
      // Keep array of objects so dropdown can show Name with value Code
      return out;
    }
  } else if (typeof s === 'object' && Object.keys(s).some((k) => /^\d+$/.test(k))) {
    arr = Object.keys(s)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => s[k])
      .filter((v): v is string => typeof v === 'string');
  }
  if (arr.length > 0) {
    out.States = { string: arr };
    return out;
  }

  // States.string (array or single)
  if (s.string != null) {
    arr = Array.isArray(s.string) ? s.string : [s.string as string];
  }
  if (arr.length > 0) {
    out.States = { string: arr };
    return out;
  }

  // State (singular) as array of objects e.g. [{ Code: "AL", Name: "Alabama" }]
  const stateList = s.State;
  if (stateList != null) {
    const items = Array.isArray(stateList) ? stateList : [stateList];
    arr = items
      .map((o: unknown) => {
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          const ob = o as Record<string, unknown>;
          return (ob.Code ?? ob.code ?? ob.Name ?? ob.name ?? '') as string;
        }
        return typeof o === 'string' ? o : '';
      })
      .filter((v) => v.length > 0);
    if (arr.length > 0) out.States = { string: arr };
  }
  return out;
}

/**
 * Fetch states for a country (typically US).
 */
export async function fetchStates(countryCode: string): Promise<FetchStatesResponse> {
  const ClientInfo = getClientInfo();
  const code = countryCode.toUpperCase();
  const raw = await postJson<FetchStatesResponse | string>(`${LOCATION_BASE}/FetchStates`, {
    ClientInfo,
    CountryCode: code,
    Transaction: TRANSACTION
  });
  return normalizeFetchStatesResponse(raw);
}

/** Address for CalculateRate; API requires Line2 and Line3 (sent as empty string if omitted). */
function normalizeRateAddress(addr: {
  Line1?: string;
  City: string;
  StateOrProvinceCode?: string;
  PostCode?: string;
  CountryCode: string;
}): { Line1: string; Line2: string; Line3: string; City: string; StateOrProvinceCode: string; PostCode: string; CountryCode: string } {
  return {
    Line1: addr.Line1 ?? '',
    Line2: '',
    Line3: '',
    City: addr.City,
    StateOrProvinceCode: addr.StateOrProvinceCode ?? '',
    PostCode: addr.PostCode ?? '',
    CountryCode: addr.CountryCode
  };
}

/**
 * Calculate shipping rate.
 * Set ARAMEX_LOG_REQUEST=true to log the full request JSON to the console (for Postman testing).
 */
export async function calculateRate(params: {
  originAddress: { Line1?: string; City: string; StateOrProvinceCode?: string; PostCode?: string; CountryCode: string };
  destinationAddress: { Line1?: string; City: string; StateOrProvinceCode?: string; PostCode?: string; CountryCode: string };
  shipmentDetails: {
    ActualWeight: { Unit: string; Value: number };
    ChargeableWeight?: { Unit: string; Value: number } | null;
    Dimensions?: { Length: number; Width: number; Height: number; Unit: string } | null;
    NumberOfPieces: number;
    ProductGroup: string;
    ProductType: string;
    PaymentType: string;
    PaymentOptions?: string;
    GoodsOriginCountry?: string | null;
    DescriptionOfGoods?: string | null;
    CustomsValueAmount?: { CurrencyCode: string; Value: number } | null;
    CashOnDeliveryAmount?: { CurrencyCode: string; Value: number } | null;
    Services?: string;
  };
  preferredCurrencyCode?: string;
}): Promise<CalculateRateResponse> {
  const ClientInfo = getClientInfo();
  const body = {
    ClientInfo,
    OriginAddress: normalizeRateAddress(params.originAddress),
    DestinationAddress: normalizeRateAddress(params.destinationAddress),
    ShipmentDetails: params.shipmentDetails,
    PreferredCurrencyCode: params.preferredCurrencyCode || 'USD',
    Transaction: TRANSACTION
  };
  const shouldLog = process.env.NODE_ENV === 'development' ||
    process.env.ARAMEX_LOG_REQUEST === 'true' ||
    process.env.ARAMEX_LOG_REQUEST === '1';
  if (shouldLog) {
    process.stdout.write('\n========== Aramex CalculateRate (copy to Postman) ==========\n');
    process.stdout.write('POST ' + RATE_CALCULATOR_URL + '\n');
    process.stdout.write('Content-Type: application/json\n\n');
    process.stdout.write(JSON.stringify(body, null, 2) + '\n');
    process.stdout.write('==========\n\n');
  }
  return postJson<CalculateRateResponse>(RATE_CALCULATOR_URL, body);
}

/**
 * Create shipments (JSON API). Returns raw response (may be JSON or XML string).
 */
export async function createShipments(body: {
  ClientInfo?: AramexClientInfo;
  LabelInfo: { ReportID: number; ReportType: string };
  Shipments: object[];
  Transaction: object;
}): Promise<CreateShipmentsResponse | string> {
  const ClientInfo = getClientInfo();
  const fullBody = { ...body, ClientInfo };
  const res = await fetch(`${SHIPPING_BASE}/CreateShipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, application/xml, text/plain' },
    body: JSON.stringify(fullBody)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Aramex CreateShipments ${res.status}: ${text}`);
  try {
    return JSON.parse(text) as CreateShipmentsResponse;
  } catch {
    return text;
  }
}

export interface ParsedCreateShipmentsResult {
  trackingId: string | null;
  labelUrl: string | null;
  hasErrors: boolean;
  rawResponse: string;
  /** Extracted error/notification messages from Aramex (root Notifications and Shipments.ProcessedShipment.Notifications). */
  errorMessages: string[];
}

function extractNotificationMessages(notifications: unknown): string[] {
  const messages: string[] = [];
  const list = Array.isArray(notifications)
    ? notifications
    : notifications && typeof notifications === 'object' && (notifications as any).Notification != null
      ? Array.isArray((notifications as any).Notification)
        ? (notifications as any).Notification
        : [(notifications as any).Notification]
      : [];
  for (const n of list) {
    const code = n?.Code ?? n?.code ?? '';
    const msg = n?.Message ?? n?.message ?? '';
    if (code || msg) messages.push(msg ? `${code ? code + ': ' : ''}${msg}` : String(n));
  }
  return messages;
}

/**
 * Parse CreateShipments API response (JSON object or XML string) and extract tracking ID, label URL, and error messages.
 */
export function parseCreateShipmentsResponse(raw: CreateShipmentsResponse | string): ParsedCreateShipmentsResult {
  const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
  let hasErrors = false;
  let trackingId: string | null = null;
  let labelUrl: string | null = null;
  const errorMessages: string[] = [];

  if (typeof raw === 'string' && raw.trim().startsWith('<')) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(raw) as any;
    const resp = parsed?.ShipmentCreationResponse ?? parsed?.CreateShipmentsResponse ?? parsed;
    if (resp?.HasErrors === true || resp?.hasErrors === true) hasErrors = true;
    errorMessages.push(...extractNotificationMessages(resp?.Notifications ?? resp?.notifications));
    const shipments = resp?.Shipments ?? resp?.shipments;
    const processed = Array.isArray(shipments?.ProcessedShipment)
      ? shipments.ProcessedShipment[0]
      : shipments?.ProcessedShipment;
    if (Array.isArray(shipments?.ProcessedShipment) && shipments.ProcessedShipment.length > 0 && !processed) {
      const first = shipments.ProcessedShipment[0];
      trackingId = first?.ID ?? first?.id ?? null;
      const label = first?.ShipmentLabel ?? first?.shipmentLabel;
      labelUrl = label?.LabelURL ?? label?.labelURL ?? null;
      errorMessages.push(...extractNotificationMessages(first?.Notifications ?? first?.notifications));
    } else if (processed) {
      trackingId = processed.ID ?? processed.id ?? null;
      const label = processed.ShipmentLabel ?? processed.shipmentLabel;
      labelUrl = label?.LabelURL ?? label?.labelURL ?? null;
      errorMessages.push(...extractNotificationMessages(processed?.Notifications ?? processed?.notifications));
    }
  } else {
    const obj = typeof raw === 'object' ? raw : (JSON.parse(rawStr) as CreateShipmentsResponse);
    hasErrors = obj.HasErrors === true;
    const notifications = (obj as any).Notifications ?? (obj as any).notifications;
    errorMessages.push(...extractNotificationMessages(notifications));
    const shipments = obj.Shipments;
    const processed = shipments?.ProcessedShipment;
    if (Array.isArray(processed) && processed.length > 0) {
      const first = processed[0];
      trackingId = first?.ID ?? null;
      labelUrl = first?.ShipmentLabel?.LabelURL ?? null;
      const notif = (first as any).Notifications ?? (first as any).notifications;
      errorMessages.push(...extractNotificationMessages(notif));
    } else if (processed && typeof processed === 'object' && 'ID' in processed) {
      trackingId = (processed as { ID?: string }).ID ?? null;
      labelUrl = (processed as { ShipmentLabel?: { LabelURL?: string } }).ShipmentLabel?.LabelURL ?? null;
      const notif = (processed as any).Notifications ?? (processed as any).notifications;
      errorMessages.push(...extractNotificationMessages(notif));
    }
  }

  return { trackingId, labelUrl, hasErrors, rawResponse: rawStr, errorMessages };
}

/**
 * Track shipments by tracking number(s).
 */
export async function trackShipments(
  shipmentNumbers: string[],
  getLastTrackingUpdateOnly = false
): Promise<TrackShipmentsResponse> {
  const ClientInfo = getClientInfo();
  return postJson<TrackShipmentsResponse>(TRACKING_URL, {
    ClientInfo,
    GetLastTrackingUpdateOnly: getLastTrackingUpdateOnly,
    Shipments: shipmentNumbers,
    LabelInfo: null
  });
}

/**
 * Create pickup (e.g. with ExistingShipments for already-created waybills).
 */
export async function createPickup(body: object): Promise<CreatePickupResponse> {
  const ClientInfo = getClientInfo();
  return postJson<CreatePickupResponse>(`${SHIPPING_BASE}/CreatePickup`, { ...body, ClientInfo });
}
