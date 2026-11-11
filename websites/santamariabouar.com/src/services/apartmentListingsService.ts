import { db } from '../config/database';

export interface ApartmentListingDetails {
  apartmentId: number;
  listingType: 'for_sale' | 'for_rent';
  description?: string | null;
  priceUsd?: number | null;
  priceNegotiable: boolean;
  contactForPrice: boolean;
  isFurnished: boolean;
  parkingSpaces: number;
  bedrooms: number;
  bathrooms: number;
  hasGarden: boolean;
  hasTerrace: boolean;
  hasBalcony: boolean;
  hasStorageRoom: boolean;
  availabilityDate?: string | null;
  petFriendly?: boolean | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
}

export interface ListingRequestPayload extends ApartmentListingDetails {
  userId: number;
}

function mapListingRow(row: Record<string, unknown>): ApartmentListingDetails {
  return {
    apartmentId: parseInt(String(row.apartmentId), 10),
    listingType: row.listingType as 'for_sale' | 'for_rent',
    description: (row.description as string) || null,
    priceUsd: row.priceUsd != null ? parseFloat(String(row.priceUsd)) : null,
    priceNegotiable: Boolean(row.priceNegotiable),
    contactForPrice: Boolean(row.contactForPrice),
    isFurnished: Boolean(row.isFurnished),
    parkingSpaces: parseInt(String(row.parkingSpaces), 10) || 0,
    bedrooms: parseInt(String(row.bedrooms), 10) || 0,
    bathrooms: parseFloat(String(row.bathrooms)) || 0,
    hasGarden: Boolean(row.hasGarden),
    hasTerrace: Boolean(row.hasTerrace),
    hasBalcony: Boolean(row.hasBalcony),
    hasStorageRoom: Boolean(row.hasStorageRoom),
    availabilityDate: (row.availabilityDate as string) || null,
    petFriendly: row.petFriendly == null ? null : Boolean(row.petFriendly),
    approvedBy: row.approvedBy ? parseInt(String(row.approvedBy), 10) : null,
    approvedAt: (row.approvedAt as string) || null
  };
}

const LISTING_SELECT = `
  apartment_id as apartmentId,
  listing_type as listingType,
  description,
  price_usd as priceUsd,
  price_negotiable as priceNegotiable,
  contact_for_price as contactForPrice,
  is_furnished as isFurnished,
  parking_spaces as parkingSpaces,
  bedrooms,
  bathrooms,
  has_garden as hasGarden,
  has_terrace as hasTerrace,
  has_balcony as hasBalcony,
  has_storage_room as hasStorageRoom,
  DATE_FORMAT(availability_date, '%Y-%m-%d') as availabilityDate,
  pet_friendly as petFriendly,
  approved_by as approvedBy,
  DATE_FORMAT(approved_at, '%Y-%m-%dT%TZ') as approvedAt
`;

export class ApartmentListingsService {
  public async getByApartmentId(apartmentId: number): Promise<ApartmentListingDetails | null> {
    const [rows] = await db.query(
      `SELECT ${LISTING_SELECT} FROM apartment_listings WHERE apartment_id = ?`,
      [apartmentId]
    );
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapListingRow(row) : null;
  }

  public async getByApartmentIds(apartmentIds: number[]): Promise<Map<number, ApartmentListingDetails>> {
    const map = new Map<number, ApartmentListingDetails>();
    if (!apartmentIds.length) return map;

    const placeholders = apartmentIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT ${LISTING_SELECT} FROM apartment_listings WHERE apartment_id IN (${placeholders})`,
      apartmentIds
    );

    for (const row of rows as Record<string, unknown>[]) {
      const listing = mapListingRow(row);
      map.set(listing.apartmentId, listing);
    }
    return map;
  }

  public async upsertFromRequest(
    data: ApartmentListingDetails,
    approvedBy?: number | null
  ): Promise<void> {
    await db.query(
      `
      INSERT INTO apartment_listings (
        apartment_id, listing_type, description,
        price_usd, price_negotiable, contact_for_price,
        is_furnished, parking_spaces, bedrooms, bathrooms,
        has_garden, has_terrace, has_balcony, has_storage_room,
        availability_date, pet_friendly,
        approved_by, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        listing_type = VALUES(listing_type),
        description = VALUES(description),
        price_usd = VALUES(price_usd),
        price_negotiable = VALUES(price_negotiable),
        contact_for_price = VALUES(contact_for_price),
        is_furnished = VALUES(is_furnished),
        parking_spaces = VALUES(parking_spaces),
        bedrooms = VALUES(bedrooms),
        bathrooms = VALUES(bathrooms),
        has_garden = VALUES(has_garden),
        has_terrace = VALUES(has_terrace),
        has_balcony = VALUES(has_balcony),
        has_storage_room = VALUES(has_storage_room),
        availability_date = VALUES(availability_date),
        pet_friendly = VALUES(pet_friendly),
        approved_by = VALUES(approved_by),
        approved_at = NOW()
      `,
      [
        data.apartmentId,
        data.listingType,
        data.description || null,
        data.contactForPrice ? null : data.priceUsd ?? null,
        data.priceNegotiable ? 1 : 0,
        data.contactForPrice ? 1 : 0,
        data.isFurnished ? 1 : 0,
        data.parkingSpaces,
        data.bedrooms,
        data.bathrooms,
        data.hasGarden ? 1 : 0,
        data.hasTerrace ? 1 : 0,
        data.hasBalcony ? 1 : 0,
        data.hasStorageRoom ? 1 : 0,
        data.availabilityDate || null,
        data.petFriendly == null ? null : data.petFriendly ? 1 : 0,
        approvedBy || null
      ]
    );
  }

  public async deleteByApartmentId(apartmentId: number): Promise<void> {
    await db.query(`DELETE FROM apartment_listings WHERE apartment_id = ?`, [apartmentId]);
  }
}

export const apartmentListingsService = new ApartmentListingsService();
