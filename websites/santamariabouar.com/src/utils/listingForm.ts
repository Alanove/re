import { ListingRequestDetails } from '../services/memberRequestsService';

export interface ParsedListingForm extends ListingRequestDetails {
  requestType: 'for_sale' | 'for_rent';
  description: string;
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === '' || value == null) return null;
  return parseBoolean(value);
}

export function parseListingFormBody(body: Record<string, unknown>): ParsedListingForm {
  const requestType = String(body.requestType || '') as 'for_sale' | 'for_rent';
  const contactForPrice = parseBoolean(body.contactForPrice);
  const priceRaw = String(body.priceUsd || '').trim();
  const priceUsd = contactForPrice || !priceRaw ? null : parseFloat(priceRaw);

  return {
    requestType,
    description: String(body.description || '').trim(),
    priceUsd: priceUsd != null && !Number.isNaN(priceUsd) ? priceUsd : null,
    priceNegotiable: parseBoolean(body.priceNegotiable),
    contactForPrice,
    isFurnished: parseBoolean(body.isFurnished),
    parkingSpaces: Math.max(0, parseInt(String(body.parkingSpaces || '0'), 10) || 0),
    bedrooms: Math.max(0, parseInt(String(body.bedrooms || '0'), 10) || 0),
    bathrooms: Math.max(0, parseFloat(String(body.bathrooms || '0')) || 0),
    hasGarden: parseBoolean(body.hasGarden),
    hasTerrace: parseBoolean(body.hasTerrace),
    hasBalcony: parseBoolean(body.hasBalcony),
    hasStorageRoom: parseBoolean(body.hasStorageRoom),
    availabilityDate: String(body.availabilityDate || '').trim() || null,
    petFriendly: requestType === 'for_rent' ? parseOptionalBoolean(body.petFriendly) : null
  };
}

export function validateListingForm(form: ParsedListingForm): string | null {
  if (form.requestType !== 'for_sale' && form.requestType !== 'for_rent') {
    return 'Invalid listing type.';
  }
  if (!form.description) {
    return 'Please add a description for your listing.';
  }
  if (!form.contactForPrice && (form.priceUsd == null || form.priceUsd <= 0)) {
    return 'Please enter a price in USD or select "Contact for price".';
  }
  if (form.bedrooms < 0 || form.bathrooms < 0 || form.parkingSpaces < 0) {
    return 'Bedrooms, bathrooms, and parking must be zero or greater.';
  }
  return null;
}

export function formatListingPrice(apartment: {
  status?: string | null;
  contactForPrice?: boolean;
  priceUsd?: number | null;
  priceNegotiable?: boolean;
}): string {
  if (apartment.contactForPrice) {
    return 'Contact for price';
  }
  if (apartment.priceUsd == null || apartment.priceUsd <= 0) {
    return 'Contact for price';
  }
  const formatted = apartment.priceUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  const suffix = apartment.status === 'for_rent' ? '/month' : '';
  const negotiable = apartment.priceNegotiable ? ' · Negotiable' : '';
  return `${formatted}${suffix}${negotiable}`;
}
