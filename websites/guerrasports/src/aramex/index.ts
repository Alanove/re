/**
 * Aramex shipping service - TypeScript wrapper and config builder.
 * Loads the JS implementation from src/aramex/aramex-service.js at runtime.
 */

import path from 'path';

// Load the JS service from src at runtime (works in both ts-node and production)
const aramexServicePath = path.join(process.cwd(), 'src', 'aramex', 'aramex-service.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AramexServiceClass = require(aramexServicePath) as new (config: AramexConfig) => IAramexService;

export interface AramexShipper {
  name: string;
  company: string;
  address: string;
  city: string;
  state: string;
  postalcode: string;
  country: string;
  phone: string;
  email: string;
}

export interface AramexConfig {
  accountCountryCode: string;
  accountEntity: string;
  accountNumber: string;
  accountPin: string;
  userName: string;
  password: string;
  shipper: AramexShipper;
  allowedDomesticMethods: Record<string, string>;
  allowedInternationalMethods: Record<string, string>;
  sandbox: boolean;
  preferredCurrency: string;
  roundUpPrice: boolean;
  reportId: number;
  logging: boolean;
}

export interface AramexRate {
  id: string;
  label: string;
  cost: number;
  currency: string;
  method: string;
  productGroup: string;
}

export interface AramexCreatePickupData {
  reference1: string;
  pickupDate?: Date | string;
  readyTime?: Date | string;
  closingTime?: Date | string;
  location?: string;
  vehicle?: string;
  comments?: string;
  productGroup?: string;
  productType?: string;
  paymentType?: string;
  numberOfShipments?: number;
  numberOfPieces?: number;
  weight?: number;
  weightUnit?: string;
  contact?: { personName?: string; companyName?: string; name?: string; company?: string; phone?: string; cellPhone?: string; email?: string };
  address?: { line1?: string; city?: string; stateOrProvinceCode?: string; state?: string; postCode?: string; postalcode?: string; countryCode?: string; country?: string };
}

export interface AramexCreatePickupResult {
  success: boolean;
  pickupId?: string | null;
  pickupGUID?: string | null;
  reference1?: string | null;
  reference2?: string | null;
}

export interface IAramexService {
  calculateShipping(packageData: AramexPackageData, weightUnit?: string, dimensionUnit?: string, options?: { throwFirstError?: boolean }): Promise<AramexRate[]>;
  createShipment(shipmentData: unknown): Promise<{ success: boolean; shipmentId?: string; labelUrl?: string | null }>;
  createPickup(pickupData: AramexCreatePickupData): Promise<AramexCreatePickupResult>;
  trackShipments(shipmentNumbers: string | string[], getLastUpdateOnly?: boolean): Promise<unknown>;
  printLabel(shipmentNumber: string, reference1?: string, reportId?: number | null): Promise<{ success: boolean; labelUrl?: string | null }>;
}

export interface AramexPackageData {
  items: Array<{
    name?: string;
    quantity: number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    regularPrice?: number;
    salePrice?: number;
    currency?: string;
  }>;
  destination: {
    country: string;
    state?: string;
    city: string;
    postcode?: string;
  };
}

/** Default international methods (commonly used) */
export const DEFAULT_INTERNATIONAL_METHODS: Record<string, string> = {
  DPX: 'Value Express Parcels',
  EDX: 'Economy Document Express',
  EPX: 'Economy Parcel Express',
  GDX: 'Ground Document Express',
  GPX: 'Ground Parcel Express',
  IBD: 'International deferred',
  PDX: 'Priority Document Express',
  PLX: 'Priority Letter Express (<.5 kg Docs)',
  PPX: 'Priority Parcel Express',
  ABX: 'ABX',
  PXP: 'Premium Express',
  DGX: 'Dangerous Goods Express',
  DGG: 'Dangerous Goods Ground'
};

/** Default domestic methods (Lebanon / regional) */
export const DEFAULT_DOMESTIC_METHODS: Record<string, string> = {
  BLK: 'Special: Bulk Mail Delivery',
  BLT: 'Domestic - Bullet Delivery',
  CDA: 'Special Delivery',
  CDS: 'E-commerce/Special Credit Card Delivery',
  OND: 'Overnight (Document)',
  ONP: 'Overnight (Parcel)',
  P24: 'Road Freight 24 hours service',
  P48: 'Road Freight 48 hours service',
  PEC: 'Economy Delivery',
  PEX: 'Road Express',
  SMD: 'Same Day (Document)',
  SMP: 'Same Day (Parcel)',
  SDD: 'Same Day Delivery',
  HVY: 'Heavy (20kgs and more)',
  LEX: 'LEX product type'
};

/**
 * Create an Aramex service instance with the given config (legacy SOAP - being replaced by JSON API).
 */
export function getAramexService(config: AramexConfig): IAramexService {
  return new AramexServiceClass(config);
}

export { getClientInfo } from './clientInfo';
export {
  fetchCountries,
  fetchCities,
  fetchStates,
  calculateRate as calculateRateJson,
  createShipments as createShipmentsJson,
  getCreateShipmentsUrl,
  parseCreateShipmentsResponse,
  trackShipments as trackShipmentsJson,
  createPickup as createPickupJson
} from './aramexApiClient';
export type { AramexClientInfo } from './clientInfo';
export type {
  FetchCountriesResponse,
  FetchCitiesResponse,
  FetchStatesResponse,
  CalculateRateResponse,
  CreateShipmentsResponse,
  ParsedCreateShipmentsResult,
  TrackShipmentsResponse,
  CreatePickupResponse
} from './aramexApiClient';
