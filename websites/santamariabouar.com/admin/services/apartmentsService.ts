import { db } from '../../src/config/database';
import * as mysql from 'mysql2/promise';
import { apartmentListingsService, ApartmentListingDetails } from '../../src/services/apartmentListingsService';

export interface GateAccessUser {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  relation: string;
  expiryDate?: string | null;
}

export type GateAccessRelation = 'Owner' | 'Tenant' | 'Family' | 'Staff' | 'Guest' | 'Other';

export type ApartmentUserRole = 'owner' | 'tenant';

export interface ApartmentUser {
  id: number;
  apartmentId: number;
  userId: number;
  role: ApartmentUserRole;
  isPrimary: boolean;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
}

export interface LinkedApartmentSummary {
  id: number;
  block: string;
  unitNumberUnofficial: string;
  unitNumberOfficial: string;
  role: ApartmentUserRole;
}

/** Apartment a user is tied to as owner, tenant, or gate-access contact. */
export interface UserApartmentRelation {
  id: number;
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial: string;
  /** Compact label, e.g. "A 10 (102)". */
  label: string;
  relation: string;
  mainOwner: string;
}

function apartmentRelationLabel(block: string, official: string, unofficial: string): string {
  const code = [block, official].filter(Boolean).join(' ');
  if (unofficial && unofficial !== official) {
    return `${code} (${unofficial})`.trim();
  }
  return code.trim();
}

/** How to link a member to an apartment on access-request approve */
export type ApartmentLinkAction = 'add_owner' | 'transfer_primary' | 'set_primary' | 'add_tenant';

export interface ApartmentOwnerHistoryEntry {
  id: number;
  userId: number;
  ownerName: string;
  ownerEmail?: string;
  startDate: string;
  endDate?: string | null;
  changedByName?: string;
}

export interface Apartment {
  id: number;
  ownerId: number;
  renterId?: number | null;
  renterName?: string;
  renterEmail?: string;
  renterPhone?: string;
  tenants?: ApartmentUser[];
  gateAccessUsers?: GateAccessUser[];
  block: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  unitNumberUnofficial: string;
  unitNumberOfficial: string;
  areaInM2: number;
  status: 'owned' | 'rented' | 'for_rent' | 'for_sale' | 'not_sold' | null;
  isVacant: boolean;
  registrationDate: string; // ISO date string for when the apartment was registered
  officialImage: string;
  images: string[];
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  listingDescription?: string | null;
  priceUsd?: number | null;
  priceNegotiable?: boolean;
  contactForPrice?: boolean;
  isFurnished?: boolean;
  parkingSpaces?: number;
  bedrooms?: number;
  bathrooms?: number;
  hasGarden?: boolean;
  hasTerrace?: boolean;
  hasBalcony?: boolean;
  hasStorageRoom?: boolean;
  availabilityDate?: string | null;
  petFriendly?: boolean | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerRole?: string;
}

export class ApartmentsService {
  private static instance: ApartmentsService;

  private constructor() {}

  public static getInstance(): ApartmentsService {
    if (!ApartmentsService.instance) {
      ApartmentsService.instance = new ApartmentsService();
    }
    return ApartmentsService.instance;
  }

  private applyListingDetails(apartment: Apartment, listing: ApartmentListingDetails | null | undefined): Apartment {
    if (!listing) return apartment;
    return {
      ...apartment,
      listingDescription: listing.description ?? apartment.listingDescription,
      priceUsd: listing.priceUsd,
      priceNegotiable: listing.priceNegotiable,
      contactForPrice: listing.contactForPrice,
      isFurnished: listing.isFurnished,
      parkingSpaces: listing.parkingSpaces,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      hasGarden: listing.hasGarden,
      hasTerrace: listing.hasTerrace,
      hasBalcony: listing.hasBalcony,
      hasStorageRoom: listing.hasStorageRoom,
      availabilityDate: listing.availabilityDate,
      petFriendly: listing.petFriendly
    };
  }

  public async getApprovedPhotoCount(apartmentId: number): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count
        FROM apartment_images
        WHERE apartment_id = ?
          AND (status = 'approved' OR status IS NULL)
      `, [apartmentId]);
      return parseInt(String((rows as { count: number }[])[0]?.count), 10) || 0;
    } catch (error) {
      console.error('Error counting approved photos:', error);
      return 0;
    }
  }

  public async listApartmentCodes(): Promise<Array<{
    id: number;
    block: string;
    unitNumberOfficial: string;
    unitNumberUnofficial: string;
  }>> {
    const [rows] = await db.query(`
      SELECT
        id,
        floor as block,
        apartment_number as unitNumberOfficial,
        COALESCE(apartment_number_unofficial, apartment_number) as unitNumberUnofficial
      FROM apartments
      ORDER BY floor, apartment_number
    `);
    return (rows as any[]).map((row) => ({
      id: Number(row.id),
      block: String(row.block || ''),
      unitNumberOfficial: String(row.unitNumberOfficial || ''),
      unitNumberUnofficial: String(row.unitNumberUnofficial || '')
    }));
  }

  public async getApartmentCode(id: number): Promise<{
    id: number;
    block: string;
    unitNumberOfficial: string;
    unitNumberUnofficial: string;
  } | null> {
    const [rows] = await db.query(`
      SELECT
        id,
        floor as block,
        apartment_number as unitNumberOfficial,
        COALESCE(apartment_number_unofficial, apartment_number) as unitNumberUnofficial
      FROM apartments
      WHERE id = ?
      LIMIT 1
    `, [id]);
    const row = (rows as any[])[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      block: String(row.block || ''),
      unitNumberOfficial: String(row.unitNumberOfficial || ''),
      unitNumberUnofficial: String(row.unitNumberUnofficial || '')
    };
  }

  public async getAllApartments(): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          a.id,
          a.owner_id as ownerId,
          a.renter_id as renterId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          a.is_vacant as isVacant,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          a.owner_name as ownerName,
          a.owner_email as ownerEmail,
          u.username as ownerUsername,
          u.email as ownerEmailFromUsers,
          u.phone as ownerPhone,
          u.role as ownerRole,
          renter.username as renterUsername,
          renter.email as renterEmailFromUsers,
          renter.phone as renterPhone
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        LEFT JOIN users renter ON a.renter_id = renter.id
        ORDER BY a.floor, a.apartment_number
      `);
      
      const apartmentIds = (rows as any[]).map((r: any) => r.id);
      const gateAccessMap = await this.getGateAccessUsersByApartmentIds(apartmentIds);
      const apartmentUsersMap = await this.listApartmentUsersByApartmentIds(apartmentIds);

      // For each apartment, get the official image
      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        const tenants = (apartmentUsersMap.get(row.id) || []).filter((m) => m.role === 'tenant');
        const primaryTenant = tenants[0];
        
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          renterId: row.renterId ? parseInt(row.renterId) : null,
          areaInM2: parseFloat(row.areaInM2) || 0,
          ownerName: row.ownerUsername || row.ownerName,
          ownerEmail: row.ownerEmailFromUsers || row.ownerEmail,
          ownerPhone: row.ownerPhone,
          renterName: row.renterUsername || primaryTenant?.name || undefined,
          renterEmail: row.renterEmailFromUsers || primaryTenant?.email || undefined,
          renterPhone: row.renterPhone || primaryTenant?.phone || undefined,
          tenants,
          isVacant: Boolean(row.isVacant),
          gateAccessUsers: gateAccessMap.get(row.id) || []
        };
      }));
      
      return apartments;
    } catch (error) {
      console.error('Error fetching apartments:', error);
      return [];
    }
  }

  public async getApartmentById(id: number): Promise<Apartment | undefined> {
    try {
      const [rows] = await db.query(`
        SELECT 
          a.id,
          a.owner_id as ownerId,
          a.renter_id as renterId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          a.is_vacant as isVacant,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          a.owner_name as ownerName,
          a.owner_email as ownerEmail,
          u.username as ownerUsername,
          u.email as ownerEmailFromUsers,
          u.phone as ownerPhone,
          u.role as ownerRole,
          renter.username as renterUsername,
          renter.email as renterEmailFromUsers,
          renter.phone as renterPhone
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        LEFT JOIN users renter ON a.renter_id = renter.id
        WHERE a.id = ?
      `, [id]);
      
      const results = rows as any[];
      if (results.length === 0) {
        return undefined;
      }
      
      const apartment = results[0];
      
      // Get images from apartment_images table
      const images = await this.getApartmentImages(id);
      const officialImage = await this.getOfficialImage(id);
      const gateAccessUsers = await this.getGateAccessUsers(id);
      const listing = await apartmentListingsService.getByApartmentId(id);
      
      return this.applyListingDetails({
        ...apartment,
        images,
        officialImage,
        ownerId: parseInt(apartment.ownerId) || 0,
        renterId: apartment.renterId ? parseInt(apartment.renterId) : null,
        areaInM2: parseFloat(apartment.areaInM2) || 0,
        ownerName: apartment.ownerUsername || apartment.ownerName,
        ownerEmail: apartment.ownerEmailFromUsers || apartment.ownerEmail,
        ownerPhone: apartment.ownerPhone,
        renterName: apartment.renterUsername || undefined,
        renterEmail: apartment.renterEmailFromUsers || undefined,
        renterPhone: apartment.renterPhone || undefined,
        isVacant: Boolean(apartment.isVacant),
        gateAccessUsers
      }, listing);
    } catch (error) {
      console.error('Error fetching apartment by ID:', error);
      return undefined;
    }
  }

  public async getApartmentsByOwner(ownerId: number): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          a.id,
          a.owner_id as ownerId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.role as ownerRole
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.owner_id = ?
        ORDER BY a.id DESC
      `, [ownerId]);
      
      // For each apartment, get the images
      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        };
      }));
      
      return apartments;
    } catch (error) {
      console.error('Error fetching apartments by owner:', error);
      return [];
    }
  }

  public async getApartmentsByRenter(renterId: number): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          a.id,
          a.owner_id as ownerId,
          a.renter_id as renterId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.role as ownerRole
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.renter_id = ?
           OR EXISTS (
             SELECT 1 FROM apartment_users au
             WHERE au.apartment_id = a.id AND au.user_id = ? AND au.role = 'tenant'
           )
        ORDER BY a.id DESC
      `, [renterId, renterId]);

      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);

        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          renterId: row.renterId ? parseInt(row.renterId) : null,
          areaInM2: parseFloat(row.areaInM2) || 0,
          memberRole: 'tenant' as const
        };
      }));

      return apartments;
    } catch (error) {
      console.error('Error fetching apartments by renter:', error);
      return [];
    }
  }

  /**
   * All apartments linked to a member via apartment_users (owner or tenant).
   * One user may be linked to many apartments.
   */
  public async getApartmentsForMember(userId: number): Promise<Array<Apartment & { memberRole: ApartmentUserRole; isPrimaryOwner: boolean }>> {
    try {
      const [rows] = await db.query(`
        SELECT
          a.id,
          a.owner_id as ownerId,
          a.renter_id as renterId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          a.is_vacant as isVacant,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.phone as ownerPhone,
          u.role as ownerRole,
          au.role as memberRole,
          au.is_primary as isPrimary
        FROM apartment_users au
        JOIN apartments a ON a.id = au.apartment_id
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE au.user_id = ?
        ORDER BY a.floor, a.apartment_number, FIELD(au.role, 'owner', 'tenant')
      `, [userId]);

      // Prefer owner role if user is both owner and tenant on same apt
      const byApt = new Map<number, any>();
      for (const row of rows as any[]) {
        const aptId = parseInt(row.id);
        const existing = byApt.get(aptId);
        if (!existing || (row.memberRole === 'owner' && existing.memberRole !== 'owner')) {
          byApt.set(aptId, row);
        }
      }

      const apartments = await Promise.all([...byApt.values()].map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          renterId: row.renterId ? parseInt(row.renterId) : null,
          isVacant: Boolean(row.isVacant),
          areaInM2: parseFloat(row.areaInM2) || 0,
          memberRole: (row.memberRole === 'tenant' ? 'tenant' : 'owner') as ApartmentUserRole,
          isPrimaryOwner: Boolean(row.isPrimary) && row.memberRole === 'owner'
        };
      }));

      return apartments;
    } catch (error) {
      console.error('Error fetching apartments for member:', error);
      return [];
    }
  }

  public async listApartmentUsers(apartmentId: number): Promise<ApartmentUser[]> {
    try {
      const [rows] = await db.query(`
        SELECT
          au.id,
          au.apartment_id as apartmentId,
          au.user_id as userId,
          au.role,
          au.is_primary as isPrimary,
          u.username as name,
          u.email,
          u.phone,
          DATE_FORMAT(au.created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM apartment_users au
        JOIN users u ON u.id = au.user_id
        WHERE au.apartment_id = ?
        ORDER BY FIELD(au.role, 'owner', 'tenant'), au.is_primary DESC, u.username
      `, [apartmentId]);

      return (rows as any[]).map((row) => this.mapApartmentUserRow(row));
    } catch (error) {
      console.error('Error listing apartment users:', error);
      return [];
    }
  }

  /**
   * Batch-load apartments linked to many users via apartment_users (owner or tenant).
   * Dedupes by apartment, preferring the owner role when a user is both.
   */
  public async getLinkedApartmentsByUserIds(
    userIds: number[]
  ): Promise<Map<number, LinkedApartmentSummary[]>> {
    const map = new Map<number, LinkedApartmentSummary[]>();
    const ids = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) {
      return map;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await db.query(
        `
        SELECT
          au.user_id as userId,
          a.id,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          au.role
        FROM apartment_users au
        JOIN apartments a ON a.id = au.apartment_id
        WHERE au.user_id IN (${placeholders})
        ORDER BY a.floor, a.apartment_number, FIELD(au.role, 'owner', 'tenant')
      `,
        ids
      );

      const seenByUser = new Map<number, Map<number, LinkedApartmentSummary>>();
      for (const row of rows as any[]) {
        const userId = parseInt(row.userId);
        const apartmentId = parseInt(row.id);
        if (!seenByUser.has(userId)) {
          seenByUser.set(userId, new Map());
        }
        const byApt = seenByUser.get(userId)!;
        const existing = byApt.get(apartmentId);
        const role: ApartmentUserRole = row.role === 'tenant' ? 'tenant' : 'owner';
        if (!existing || (role === 'owner' && existing.role !== 'owner')) {
          byApt.set(apartmentId, {
            id: apartmentId,
            block: row.block,
            unitNumberUnofficial: row.unitNumberUnofficial,
            unitNumberOfficial: row.unitNumberOfficial,
            role
          });
        }
      }

      for (const [userId, byApt] of seenByUser) {
        map.set(userId, [...byApt.values()]);
      }
    } catch (error) {
      console.error('Error listing linked apartments by user IDs:', error);
    }

    return map;
  }

  /**
   * Apartments a user is related to: recorded owner, tenant, apartment_users,
   * or gate access. One row per apartment, keeping the closest relation.
   */
  public async getApartmentRelationsByUserIds(
    userIds: number[]
  ): Promise<Map<number, UserApartmentRelation[]>> {
    const map = new Map<number, UserApartmentRelation[]>();
    const ids = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) {
      return map;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await db.query(
        `
        SELECT userId, id, block, unitNumberOfficial, unitNumberUnofficial, relation, mainOwner, sortRank
        FROM (
          SELECT
            a.owner_id as userId,
            a.id,
            a.floor as block,
            a.apartment_number as unitNumberOfficial,
            a.apartment_number_unofficial as unitNumberUnofficial,
            'Owner' as relation,
            COALESCE(NULLIF(owner.username, ''), NULLIF(a.owner_name, ''), '') as mainOwner,
            1 as sortRank
          FROM apartments a
          LEFT JOIN users owner ON owner.id = a.owner_id
          WHERE a.owner_id IN (${placeholders})

          UNION ALL

          SELECT
            a.renter_id as userId,
            a.id,
            a.floor as block,
            a.apartment_number as unitNumberOfficial,
            a.apartment_number_unofficial as unitNumberUnofficial,
            'Tenant' as relation,
            COALESCE(NULLIF(owner.username, ''), NULLIF(a.owner_name, ''), '') as mainOwner,
            2 as sortRank
          FROM apartments a
          LEFT JOIN users owner ON owner.id = a.owner_id
          WHERE a.renter_id IN (${placeholders})

          UNION ALL

          SELECT
            au.user_id as userId,
            a.id,
            a.floor as block,
            a.apartment_number as unitNumberOfficial,
            a.apartment_number_unofficial as unitNumberUnofficial,
            CASE au.role WHEN 'owner' THEN 'Owner' WHEN 'tenant' THEN 'Tenant' ELSE au.role END as relation,
            COALESCE(NULLIF(owner.username, ''), NULLIF(a.owner_name, ''), '') as mainOwner,
            CASE au.role WHEN 'owner' THEN 1 WHEN 'tenant' THEN 2 ELSE 3 END as sortRank
          FROM apartment_users au
          JOIN apartments a ON a.id = au.apartment_id
          LEFT JOIN users owner ON owner.id = a.owner_id
          WHERE au.user_id IN (${placeholders})

          UNION ALL

          SELECT
            aga.user_id as userId,
            a.id,
            a.floor as block,
            a.apartment_number as unitNumberOfficial,
            a.apartment_number_unofficial as unitNumberUnofficial,
            COALESCE(aga.relation, 'Other') as relation,
            COALESCE(NULLIF(owner.username, ''), NULLIF(a.owner_name, ''), '') as mainOwner,
            CASE aga.relation
              WHEN 'Owner' THEN 1
              WHEN 'Tenant' THEN 2
              WHEN 'Family' THEN 3
              WHEN 'Staff' THEN 4
              WHEN 'Guest' THEN 5
              ELSE 6
            END as sortRank
          FROM apartment_gate_access aga
          JOIN apartments a ON a.id = aga.apartment_id
          LEFT JOIN users owner ON owner.id = a.owner_id
          WHERE aga.user_id IN (${placeholders})
        ) links
        ORDER BY block, unitNumberOfficial, sortRank
        `,
        [...ids, ...ids, ...ids, ...ids]
      );

      const seenByUser = new Map<number, Map<number, { sortRank: number; relation: UserApartmentRelation }>>();
      for (const row of rows as any[]) {
        const userId = parseInt(row.userId, 10);
        const apartmentId = parseInt(row.id, 10);
        const sortRank = parseInt(row.sortRank, 10) || 9;
        if (!seenByUser.has(userId)) {
          seenByUser.set(userId, new Map());
        }
        const byApt = seenByUser.get(userId)!;
        const existing = byApt.get(apartmentId);
        if (existing && existing.sortRank <= sortRank) {
          continue;
        }
        byApt.set(apartmentId, {
          sortRank,
          relation: {
            id: apartmentId,
            block: row.block || '',
            unitNumberOfficial: row.unitNumberOfficial || '',
            unitNumberUnofficial: row.unitNumberUnofficial || '',
            label: apartmentRelationLabel(row.block || '', row.unitNumberOfficial || '', row.unitNumberUnofficial || ''),
            relation: row.relation || 'Other',
            mainOwner: row.mainOwner || ''
          }
        });
      }

      for (const [userId, byApt] of seenByUser) {
        map.set(
          userId,
          [...byApt.values()]
            .sort((a, b) => {
              const blockCmp = a.relation.block.localeCompare(b.relation.block, undefined, { sensitivity: 'base' });
              if (blockCmp !== 0) return blockCmp;
              return a.relation.unitNumberOfficial.localeCompare(b.relation.unitNumberOfficial, undefined, {
                numeric: true,
                sensitivity: 'base'
              });
            })
            .map((entry) => entry.relation)
        );
      }
    } catch (error) {
      console.error('Error listing apartment relations by user IDs:', error);
    }

    return map;
  }

  /**
   * Batch-load apartment_users (owners and tenants) for many apartments.
   */
  public async listApartmentUsersByApartmentIds(
    apartmentIds: number[]
  ): Promise<Map<number, ApartmentUser[]>> {
    const map = new Map<number, ApartmentUser[]>();
    const ids = Array.from(new Set(apartmentIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) {
      return map;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await db.query(
        `
        SELECT
          au.id,
          au.apartment_id as apartmentId,
          au.user_id as userId,
          au.role,
          au.is_primary as isPrimary,
          u.username as name,
          u.email,
          u.phone,
          DATE_FORMAT(au.created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM apartment_users au
        JOIN users u ON u.id = au.user_id
        WHERE au.apartment_id IN (${placeholders})
        ORDER BY FIELD(au.role, 'tenant', 'owner'), au.is_primary DESC, u.username
      `,
        ids
      );

      for (const row of rows as any[]) {
        const member = this.mapApartmentUserRow(row);
        if (!map.has(member.apartmentId)) {
          map.set(member.apartmentId, []);
        }
        map.get(member.apartmentId)!.push(member);
      }
    } catch (error) {
      console.error('Error listing apartment users by apartment IDs:', error);
    }

    return map;
  }

  private mapApartmentUserRow(row: any): ApartmentUser {
    return {
      id: parseInt(row.id),
      apartmentId: parseInt(row.apartmentId),
      userId: parseInt(row.userId),
      role: row.role === 'tenant' ? 'tenant' : 'owner',
      isPrimary: Boolean(row.isPrimary),
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      createdAt: row.createdAt
    };
  }

  public async getMemberApartmentLink(
    apartmentId: number,
    userId: number
  ): Promise<{ role: ApartmentUserRole; isPrimary: boolean } | null> {
    try {
      const [rows] = await db.query(`
        SELECT role, is_primary as isPrimary
        FROM apartment_users
        WHERE apartment_id = ? AND user_id = ?
        ORDER BY FIELD(role, 'owner', 'tenant')
        LIMIT 1
      `, [apartmentId, userId]);
      if (!(rows as any[]).length) return null;
      const row = (rows as any[])[0];
      return {
        role: row.role === 'tenant' ? 'tenant' : 'owner',
        isPrimary: Boolean(row.isPrimary)
      };
    } catch (error) {
      console.error('Error getting member apartment link:', error);
      return null;
    }
  }

  /**
   * Add or update a user link on an apartment without affecting other apartments.
   */
  public async addApartmentUser(
    apartmentId: number,
    userId: number,
    role: ApartmentUserRole,
    options?: { isPrimary?: boolean; changedBy?: number }
  ): Promise<boolean> {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [userRows] = await conn.query(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!(userRows as any[]).length) {
        throw new Error('User not found');
      }

      const wantPrimary = role === 'owner' && Boolean(options?.isPrimary);

      if (wantPrimary) {
        await conn.query(`
          UPDATE apartment_users
          SET is_primary = 0
          WHERE apartment_id = ? AND role = 'owner' AND is_primary = 1
        `, [apartmentId]);
      }

      await conn.query(`
        INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          is_primary = IF(VALUES(is_primary) = 1, 1, is_primary)
      `, [apartmentId, userId, role, wantPrimary ? 1 : 0]);

      if (wantPrimary) {
        await this.syncPrimaryOwnerCache(conn, apartmentId, options?.changedBy);
      } else if (role === 'tenant') {
        await this.syncRenterCache(conn, apartmentId);
      }

      await conn.commit();

      const apt = await this.getApartmentById(apartmentId);
      if (apt) {
        await this.syncDefaultGateAccess(apartmentId, apt.ownerId || null, apt.renterId ?? null);
        if (role === 'owner' && !wantPrimary) {
          await this.upsertGateAccessUser(apartmentId, userId, 'Owner');
        }
      }
      return true;
    } catch (error) {
      await conn.rollback();
      console.error('Error adding apartment user:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  public async setPrimaryOwner(
    apartmentId: number,
    userId: number,
    options?: { changedBy?: number }
  ): Promise<boolean> {
    return this.addApartmentUser(apartmentId, userId, 'owner', {
      isPrimary: true,
      changedBy: options?.changedBy
    });
  }

  public async removeApartmentUser(
    apartmentId: number,
    userId: number,
    role: ApartmentUserRole,
    options?: { changedBy?: number }
  ): Promise<boolean> {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query(`
        SELECT is_primary as isPrimary FROM apartment_users
        WHERE apartment_id = ? AND user_id = ? AND role = ?
      `, [apartmentId, userId, role]);
      if (!(existing as any[]).length) {
        await conn.rollback();
        return false;
      }
      const wasPrimary = Boolean((existing as any[])[0].isPrimary);

      await conn.query(`
        DELETE FROM apartment_users
        WHERE apartment_id = ? AND user_id = ? AND role = ?
      `, [apartmentId, userId, role]);

      if (role === 'owner' && wasPrimary) {
        const [nextOwner] = await conn.query(`
          SELECT user_id as userId FROM apartment_users
          WHERE apartment_id = ? AND role = 'owner'
          ORDER BY id ASC LIMIT 1
        `, [apartmentId]);
        if ((nextOwner as any[]).length) {
          await conn.query(`
            UPDATE apartment_users SET is_primary = 1
            WHERE apartment_id = ? AND user_id = ? AND role = 'owner'
          `, [apartmentId, (nextOwner as any[])[0].userId]);
        }
        await this.syncPrimaryOwnerCache(conn, apartmentId, options?.changedBy);
      } else if (role === 'tenant') {
        await this.syncRenterCache(conn, apartmentId);
      }

      await conn.commit();

      const apt = await this.getApartmentById(apartmentId);
      if (apt) {
        await this.syncDefaultGateAccess(apartmentId, apt.ownerId || null, apt.renterId ?? null);
      }
      return true;
    } catch (error) {
      await conn.rollback();
      console.error('Error removing apartment user:', error);
      return false;
    } finally {
      conn.release();
    }
  }

  /**
   * Link a member on access-request approve without overwriting primary unless requested.
   */
  public async linkMemberOnApprove(
    apartmentId: number,
    userId: number,
    action: ApartmentLinkAction,
    options?: { changedBy?: number }
  ): Promise<void> {
    switch (action) {
      case 'add_tenant':
        await this.addApartmentUser(apartmentId, userId, 'tenant', { changedBy: options?.changedBy });
        break;
      case 'add_owner':
        await this.addApartmentUser(apartmentId, userId, 'owner', {
          isPrimary: false,
          changedBy: options?.changedBy
        });
        break;
      case 'set_primary':
      case 'transfer_primary':
        await this.setPrimaryOwner(apartmentId, userId, { changedBy: options?.changedBy });
        break;
      default:
        throw new Error(`Unknown link action: ${action}`);
    }
  }

  /** Sync apartments.owner_id (+ denormalized fields) from apartment_users primary owner */
  private async syncPrimaryOwnerCache(
    conn: mysql.PoolConnection,
    apartmentId: number,
    changedBy?: number
  ): Promise<void> {
    const [currentRows] = await conn.query(`
      SELECT owner_id as ownerId FROM apartments WHERE id = ?
    `, [apartmentId]);
    const currentOwnerId = (currentRows as any[])[0]?.ownerId ?? null;

    const [primaryRows] = await conn.query(`
      SELECT au.user_id as userId, u.username, u.email, u.phone
      FROM apartment_users au
      JOIN users u ON u.id = au.user_id
      WHERE au.apartment_id = ? AND au.role = 'owner' AND au.is_primary = 1
      LIMIT 1
    `, [apartmentId]);

    const primary = (primaryRows as any[])[0];
    const newOwnerId = primary ? parseInt(primary.userId) : null;
    const ownerName = primary?.username || '';
    const ownerEmail = primary?.email || '';
    const ownerPhone = primary?.phone || '';

    await conn.query(`
      UPDATE apartments
      SET owner_id = ?, owner_name = ?, owner_email = ?, owner_phone = ?
      WHERE id = ?
    `, [newOwnerId, ownerName, ownerEmail, ownerPhone, apartmentId]);

    if (newOwnerId !== currentOwnerId) {
      await this.recordOwnerChange(conn, apartmentId, newOwnerId, changedBy);
    }
  }

  /** Sync apartments.renter_id from first tenant in apartment_users (or null) */
  private async syncRenterCache(
    conn: mysql.PoolConnection,
    apartmentId: number
  ): Promise<void> {
    const [tenantRows] = await conn.query(`
      SELECT user_id as userId FROM apartment_users
      WHERE apartment_id = ? AND role = 'tenant'
      ORDER BY id ASC LIMIT 1
    `, [apartmentId]);
    const renterId = (tenantRows as any[])[0]?.userId ?? null;
    await conn.query(`UPDATE apartments SET renter_id = ? WHERE id = ?`, [renterId, apartmentId]);
  }

  public async getApartmentsByBlock(block: string): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          a.id,
          a.owner_id as ownerId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.role as ownerRole
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.floor = ?
        ORDER BY a.id DESC
      `, [block]);
      
      // For each apartment, get the images
      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        };
      }));
      
      return apartments;
    } catch (error) {
      console.error('Error fetching apartments by block:', error);
      return [];
    }
  }

  public async addApartment(
    apartmentData: Omit<Apartment, 'id' | 'createdAt'>,
    options?: { changedBy?: number }
  ): Promise<Apartment> {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Get owner information from users table
      let ownerName = '';
      let ownerEmail = '';
      let ownerPhone = '';
      
      if (apartmentData.ownerId) {
        const [userRows] = await conn.query(`
          SELECT username, email, phone 
          FROM users 
          WHERE id = ?
        `, [apartmentData.ownerId]);
        
        if (userRows && (userRows as any[]).length > 0) {
          const user = (userRows as any[])[0];
          ownerName = user.username || '';
          ownerEmail = user.email || '';
          ownerPhone = user.phone || '';
        }
      }

      const renterId = apartmentData.renterId ?? null;
      const startDate = apartmentData.registrationDate
        ? apartmentData.registrationDate.split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      const [result] = await conn.query(`
        INSERT INTO apartments (apartment_number, apartment_number_unofficial, owner_id, renter_id, owner_name, owner_phone, owner_email, floor, size, status, registration_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        apartmentData.unitNumberOfficial,
        apartmentData.unitNumberUnofficial,
        apartmentData.ownerId,
        renterId,
        ownerName,
        ownerPhone,
        ownerEmail,
        apartmentData.block,
        apartmentData.areaInM2,
        apartmentData.status || null,
        startDate,
        apartmentData.notes || null
      ]);
      
      const insertId = (result as any).insertId;

      if (apartmentData.ownerId) {
        let validChangedBy: number | null = null;
        if (options?.changedBy) {
          const [changedByRows] = await conn.query(`SELECT id FROM users WHERE id = ?`, [options.changedBy]);
          if ((changedByRows as any[]).length > 0) {
            validChangedBy = options.changedBy;
          }
        }
        await conn.query(`
          INSERT INTO apartment_owner_history (apartment_id, user_id, start_date, end_date, changed_by)
          VALUES (?, ?, ?, NULL, ?)
        `, [insertId, apartmentData.ownerId, startDate, validChangedBy]);

        await conn.query(`
          INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
          VALUES (?, ?, 'owner', 1)
        `, [insertId, apartmentData.ownerId]);
      }

      if (renterId && renterId !== apartmentData.ownerId) {
        await conn.query(`
          INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
          VALUES (?, ?, 'tenant', 0)
        `, [insertId, renterId]);
      }

      await conn.commit();
      conn.release();

      await this.syncDefaultGateAccess(insertId, apartmentData.ownerId || null, apartmentData.renterId ?? null);

      const newApartment = await this.getApartmentById(insertId);
      if (!newApartment) throw new Error('Failed to retrieve created apartment');
      return newApartment;
    } catch (error) {
      await conn.rollback();
      conn.release();
      console.error('Error adding apartment:', error);
      throw new Error('Failed to add apartment');
    }
  }

  public async updateApartment(
    id: number,
    updates: Partial<Omit<Apartment, 'id' | 'createdAt'>>,
    options?: { changedBy?: number }
  ): Promise<Apartment | null> {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [currentRows] = await conn.query(`
        SELECT owner_id as ownerId FROM apartments WHERE id = ?
      `, [id]);
      const currentOwnerId = (currentRows as any[])[0]?.ownerId ?? null;

      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.unitNumberOfficial !== undefined) {
        updateFields.push('apartment_number = ?');
        values.push(updates.unitNumberOfficial);
      }
      if (updates.unitNumberUnofficial !== undefined) {
        updateFields.push('apartment_number_unofficial = ?');
        values.push(updates.unitNumberUnofficial);
      }
      if (updates.ownerId !== undefined) {
        updateFields.push('owner_id = ?');
        values.push(updates.ownerId);
        
        let ownerName = '';
        let ownerEmail = '';
        let ownerPhone = '';
        
        if (updates.ownerId) {
          const [userRows] = await conn.query(`
            SELECT username, email, phone 
            FROM users 
            WHERE id = ?
          `, [updates.ownerId]);
          
          if (userRows && (userRows as any[]).length > 0) {
            const user = (userRows as any[])[0];
            ownerName = user.username || '';
            ownerEmail = user.email || '';
            ownerPhone = user.phone || '';
          }
        }
        
        updateFields.push('owner_name = ?');
        values.push(ownerName);
        updateFields.push('owner_phone = ?');
        values.push(ownerPhone);
        updateFields.push('owner_email = ?');
        values.push(ownerEmail);

        const newOwnerId = updates.ownerId || null;
        if (newOwnerId !== currentOwnerId) {
          await this.recordOwnerChange(conn, id, newOwnerId, options?.changedBy);
        }

        // Keep apartment_users primary owner in sync (transfer / set primary)
        if (newOwnerId) {
          await conn.query(`
            UPDATE apartment_users
            SET is_primary = 0
            WHERE apartment_id = ? AND role = 'owner' AND is_primary = 1
          `, [id]);
          await conn.query(`
            INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
            VALUES (?, ?, 'owner', 1)
            ON DUPLICATE KEY UPDATE is_primary = 1
          `, [id, newOwnerId]);
        } else {
          await conn.query(`
            UPDATE apartment_users
            SET is_primary = 0
            WHERE apartment_id = ? AND role = 'owner' AND is_primary = 1
          `, [id]);
        }
      }
      if (updates.renterId !== undefined) {
        updateFields.push('renter_id = ?');
        values.push(updates.renterId || null);

        const newRenterId = updates.renterId || null;
        if (newRenterId) {
          await conn.query(`
            INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
            VALUES (?, ?, 'tenant', 0)
            ON DUPLICATE KEY UPDATE role = 'tenant'
          `, [id, newRenterId]);
        }
      }
      if (updates.block !== undefined) {
        updateFields.push('floor = ?');
        values.push(updates.block);
      }
      if (updates.areaInM2 !== undefined) {
        updateFields.push('size = ?');
        values.push(updates.areaInM2);
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.isVacant !== undefined) {
        updateFields.push('is_vacant = ?');
        values.push(updates.isVacant ? 1 : 0);
      }
      if (updates.registrationDate !== undefined) {
        updateFields.push('registration_date = ?');
        values.push(updates.registrationDate.split('T')[0]);
      }
      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        values.push(updates.notes);
      }
      if (updates.listingDescription !== undefined) {
        updateFields.push('listing_description = ?');
        values.push(updates.listingDescription);
      }

      if (updateFields.length > 0) {
        values.push(id);
        await conn.query(`
          UPDATE apartments
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `, values);
      }

      await conn.commit();
      conn.release();

      if (updates.ownerId !== undefined || updates.renterId !== undefined) {
        const updated = await this.getApartmentById(id);
        if (updated) {
          await this.syncDefaultGateAccess(id, updated.ownerId || null, updated.renterId ?? null);
        }
      }
      
      return await this.getApartmentById(id) || null;
    } catch (error) {
      await conn.rollback();
      conn.release();
      console.error('Error updating apartment:', error);
      return null;
    }
  }

  public async deleteApartment(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM apartments WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting apartment:', error);
      return false;
    }
  }

  public async isUnitNumberTaken(unitNumber: string, block: string, excludeId?: number): Promise<boolean> {
    try {
      let query = `
        SELECT COUNT(*) as count
        FROM apartments
        WHERE (apartment_number = ? OR apartment_number_unofficial = ?)
        AND floor = ?
      `;
      const params: any[] = [unitNumber, unitNumber, block];
      
      if (excludeId !== undefined) {
        query += ` AND id != ?`;
        params.push(excludeId);
      }
      
      const [rows] = await db.query(query, params);
      return (rows as any[])[0].count > 0;
    } catch (error) {
      console.error('Error checking unit number:', error);
      return false;
    }
  }

  public getAvailableBlocks(): string[] {
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  }

  public async getTotalApartments(): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count FROM apartments
      `);
      return (rows as any[])[0].count;
    } catch (error) {
      console.error('Error getting total apartments:', error);
      return 0;
    }
  }

  public async getTotalAreaByBlock(block: string): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT IFNULL(SUM(size), 0) as total
        FROM apartments
        WHERE floor = ?
      `, [block]);
      return parseFloat((rows as any[])[0].total) || 0;
    } catch (error) {
      console.error('Error getting total area by block:', error);
      return 0;
    }
  }

  public async getApartmentStats(): Promise<{
    totalApartments: number;
    totalArea: number;
    apartmentsByBlock: { [key: string]: number };
    averageArea: number;
  }> {
    try {
      const [rows] = await db.query(`
        SELECT 
          COUNT(*) as totalApartments,
          IFNULL(SUM(size), 0) as totalArea,
          floor as block
        FROM apartments
        GROUP BY floor
      `);
      
      const totalApartments = await this.getTotalApartments();
      const apartmentsByBlock: { [key: string]: number } = {};
      let totalArea = 0;
      
      (rows as any[]).forEach((row: any) => {
        apartmentsByBlock[row.block] = parseInt(row.totalApartments) || 0;
        totalArea += parseFloat(row.totalArea) || 0;
      });
      
      // Initialize all blocks with 0 if not present
      this.getAvailableBlocks().forEach(block => {
        if (!apartmentsByBlock[block]) {
          apartmentsByBlock[block] = 0;
        }
      });
      
      return {
        totalApartments,
        totalArea,
        apartmentsByBlock,
        averageArea: totalApartments > 0 ? totalArea / totalApartments : 0
      };
    } catch (error) {
      console.error('Error getting apartment stats:', error);
      return {
        totalApartments: 0,
        totalArea: 0,
        apartmentsByBlock: {},
        averageArea: 0
      };
    }
  }

  // Image methods - storing in apartment_images table
  public async addImageToApartment(apartmentId: number, imageName: string): Promise<boolean> {
    try {
      await db.query(`
        INSERT INTO apartment_images (apartment_id, image_filename, is_official, display_order)
        VALUES (?, ?, FALSE, 0)
      `, [apartmentId, imageName]);
      return true;
    } catch (error) {
      console.error('Error adding image to apartment:', error);
      return false;
    }
  }

  public async removeImageFromApartment(apartmentId: number, imageName: string): Promise<boolean> {
    try {
      await db.query(`
        DELETE FROM apartment_images
        WHERE apartment_id = ? AND image_filename = ?
      `, [apartmentId, imageName]);
      return true;
    } catch (error) {
      console.error('Error removing image from apartment:', error);
      return false;
    }
  }

  public async setOfficialImage(apartmentId: number, imageName: string): Promise<boolean> {
    try {
      // First, unset all other official images for this apartment
      await db.query(`
        UPDATE apartment_images
        SET is_official = FALSE
        WHERE apartment_id = ? AND is_official = TRUE
      `, [apartmentId]);
      
      // Check if image already exists
      const [existing] = await db.query(`
        SELECT id FROM apartment_images
        WHERE apartment_id = ? AND image_filename = ?
      `, [apartmentId, imageName]);
      
      if ((existing as any[]).length > 0) {
        // Update existing image to be official
        await db.query(`
          UPDATE apartment_images
          SET is_official = TRUE
          WHERE apartment_id = ? AND image_filename = ?
        `, [apartmentId, imageName]);
      } else {
        // Insert new official image
        await db.query(`
          INSERT INTO apartment_images (apartment_id, image_filename, is_official)
          VALUES (?, ?, TRUE)
        `, [apartmentId, imageName]);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting official image:', error);
      return false;
    }
  }

  public async removeOfficialImage(apartmentId: number): Promise<boolean> {
    try {
      await db.query(`
        UPDATE apartment_images
        SET is_official = FALSE
        WHERE apartment_id = ? AND is_official = TRUE
      `, [apartmentId]);
      return true;
    } catch (error) {
      console.error('Error removing official image:', error);
      return false;
    }
  }
  
  public async getApartmentImages(apartmentId: number): Promise<string[]> {
    try {
      const [rows] = await db.query(`
        SELECT image_filename
        FROM apartment_images
        WHERE apartment_id = ? AND is_official = FALSE
          AND (status = 'approved' OR status IS NULL)
        ORDER BY display_order, created_at
      `, [apartmentId]);

      return (rows as any[]).map(row => row.image_filename);
    } catch (error) {
      console.error('Error getting apartment images:', error);
      return [];
    }
  }

  public async getOfficialImage(apartmentId: number): Promise<string> {
    try {
      const [rows] = await db.query(`
        SELECT image_filename
        FROM apartment_images
        WHERE apartment_id = ? AND is_official = TRUE
          AND (status = 'approved' OR status IS NULL)
        LIMIT 1
      `, [apartmentId]);

      const results = rows as any[];
      return results.length > 0 ? results[0].image_filename : '';
    } catch (error) {
      console.error('Error getting official image:', error);
      return '';
    }
  }

  public async addPendingImageToApartment(
    apartmentId: number,
    imageName: string,
    uploadedBy: number
  ): Promise<boolean> {
    try {
      await db.query(`
        INSERT INTO apartment_images (apartment_id, image_filename, is_official, status, uploaded_by, display_order)
        VALUES (?, ?, FALSE, 'pending', ?, 0)
      `, [apartmentId, imageName, uploadedBy]);
      return true;
    } catch (error) {
      console.error('Error adding pending image to apartment:', error);
      return false;
    }
  }

  public async getPendingImages(apartmentId?: number): Promise<Array<{
    id: number;
    apartmentId: number;
    imageFilename: string;
    uploadedBy: number | null;
    createdAt: string;
    apartmentLabel?: string;
    uploaderName?: string;
    uploaderEmail?: string;
    uploaderPhone?: string;
  }>> {
    try {
      let query = `
        SELECT
          ai.id,
          ai.apartment_id as apartmentId,
          ai.image_filename as imageFilename,
          ai.uploaded_by as uploadedBy,
          DATE_FORMAT(ai.created_at, '%Y-%m-%dT%TZ') as createdAt,
          CONCAT('Block ', COALESCE(a.floor, ''), ' ', COALESCE(a.apartment_number, ''), ' (', COALESCE(a.apartment_number_unofficial, ''), ')') as apartmentLabel,
          u.username as uploaderName,
          u.email as uploaderEmail,
          u.phone as uploaderPhone
        FROM apartment_images ai
        LEFT JOIN apartments a ON a.id = ai.apartment_id
        LEFT JOIN users u ON u.id = ai.uploaded_by
        WHERE ai.status = 'pending'
      `;
      const params: any[] = [];
      if (apartmentId) {
        query += ` AND ai.apartment_id = ?`;
        params.push(apartmentId);
      }
      query += ` ORDER BY ai.created_at DESC`;
      const [rows] = await db.query(query, params);
      return (rows as any[]).map(row => ({
        ...row,
        id: parseInt(row.id),
        apartmentId: parseInt(row.apartmentId),
        uploadedBy: row.uploadedBy ? parseInt(row.uploadedBy) : null
      }));
    } catch (error) {
      console.error('Error getting pending images:', error);
      return [];
    }
  }

  public async approvePendingImage(imageId: number): Promise<boolean> {
    try {
      const [rows] = await db.query(`
        SELECT apartment_id as apartmentId, image_filename as filename
        FROM apartment_images
        WHERE id = ? AND status = 'pending'
      `, [imageId]);
      const row = (rows as any[])[0];
      if (!row) return false;

      const [result] = await db.query(`
        UPDATE apartment_images SET status = 'approved' WHERE id = ? AND status = 'pending'
      `, [imageId]);
      if ((result as any).affectedRows === 0) return false;

      const apartmentId = parseInt(row.apartmentId, 10);
      const existingOfficial = await this.getOfficialImage(apartmentId);
      if (!existingOfficial) {
        await this.setOfficialImage(apartmentId, row.filename);
      }

      return true;
    } catch (error) {
      console.error('Error approving pending image:', error);
      return false;
    }
  }

  public async rejectPendingImage(imageId: number): Promise<{ filename: string; apartmentId: number } | null> {
    try {
      const [rows] = await db.query(`
        SELECT image_filename as filename, apartment_id as apartmentId
        FROM apartment_images WHERE id = ? AND status = 'pending'
      `, [imageId]);
      const row = (rows as any[])[0];
      if (!row) return null;
      await db.query(`DELETE FROM apartment_images WHERE id = ?`, [imageId]);
      return { filename: row.filename, apartmentId: parseInt(row.apartmentId) };
    } catch (error) {
      console.error('Error rejecting pending image:', error);
      return null;
    }
  }

  public async getMemberPendingImages(apartmentId: number): Promise<string[]> {
    try {
      const [rows] = await db.query(`
        SELECT image_filename
        FROM apartment_images
        WHERE apartment_id = ? AND status = 'pending'
        ORDER BY created_at DESC
      `, [apartmentId]);
      return (rows as any[]).map(row => row.image_filename);
    } catch (error) {
      console.error('Error getting member pending images:', error);
      return [];
    }
  }

  public async getRecentApartmentsByStatus(
    status: 'owned' | 'for_rent' | 'for_sale' | 'not_sold' | null,
    limit: number = 3
  ): Promise<Apartment[]> {
    try {
      const safeLimit = Math.max(1, Math.min(50, Number(limit) || 3));
      const [rows] = await db.query(`
        SELECT
          a.id,
          a.owner_id as ownerId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.role as ownerRole
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.status = ?
        ORDER BY a.id DESC
        LIMIT ${safeLimit}
      `, [status]);

      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);

        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        };
      }));

      return apartments;
    } catch (error) {
      console.error('Error fetching recent apartments by status:', error);
      return [];
    }
  }

  public async getApartmentsByStatus(status: 'owned' | 'for_rent' | 'for_sale' | 'not_sold' | null): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT
          a.id,
          a.owner_id as ownerId,
          a.floor as block,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          a.apartment_number as unitNumberOfficial,
          a.size as areaInM2,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          a.listing_description as listingDescription,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(a.updated_at, '%Y-%m-%dT%TZ') as updatedAt,
          u.username as ownerName,
          u.email as ownerEmail,
          u.role as ownerRole
        FROM apartments a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.status = ?
        ORDER BY a.id DESC
      `, [status]);

      // For each apartment, get the images and listing details
      const apartmentIds = (rows as any[]).map((row: any) => row.id);
      const listingsMap = await apartmentListingsService.getByApartmentIds(apartmentIds);

      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);

        return this.applyListingDetails({
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        }, listingsMap.get(row.id));
      }));

      return apartments;
    } catch (error) {
      console.error('Error fetching apartments by status:', error);
      return [];
    }
  }

  public getAvailableStatuses(): Array<{ value: string | null, label: string }> {
    return [
      { value: 'owned', label: 'Owned' },
      { value: 'rented', label: 'Rented' },
      { value: 'for_rent', label: 'For Rent' },
      { value: 'for_sale', label: 'For Sale' },
      { value: 'not_sold', label: 'Not Sold' }
    ];
  }

  /**
   * Get apartments with their owner information using the apartment_owners view
   * This is more efficient than individual JOINs
   */
  public async getApartmentsWithOwners(): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          apartment_id as id,
          owner_id as ownerId,
          floor as block,
          COALESCE(apartment_number_unofficial, apartment_number) as unitNumberUnofficial,
          apartment_number as unitNumberOfficial,
          size as areaInM2,
          status,
          DATE_FORMAT(registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          notes,
          DATE_FORMAT(apartment_created_at, '%Y-%m-%dT%TZ') as createdAt,
          owner_name as ownerName,
          owner_email as ownerEmail,
          owner_phone as ownerPhone,
          owner_role as ownerRole
        FROM apartment_owners
        ORDER BY apartment_id DESC
      `);
      
      // For each apartment, get the images
      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        };
      }));
      
      return apartments;
    } catch (error) {
      console.error('Error fetching apartments with owners:', error);
      return [];
    }
  }

  /**
   * Get apartments by owner using the apartment_owners view
   */
  public async getApartmentsByOwnerId(ownerId: number): Promise<Apartment[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          apartment_id as id,
          owner_id as ownerId,
          floor as block,
          COALESCE(apartment_number_unofficial, apartment_number) as unitNumberUnofficial,
          apartment_number as unitNumberOfficial,
          size as areaInM2,
          status,
          DATE_FORMAT(registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          notes,
          DATE_FORMAT(apartment_created_at, '%Y-%m-%dT%TZ') as createdAt,
          owner_name as ownerName,
          owner_email as ownerEmail,
          owner_phone as ownerPhone,
          owner_role as ownerRole
        FROM apartment_owners
        WHERE owner_id = ?
        ORDER BY apartment_id DESC
      `, [ownerId]);
      
      // For each apartment, get the images
      const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
        const officialImage = await this.getOfficialImage(row.id);
        const images = await this.getApartmentImages(row.id);
        
        return {
          ...row,
          images,
          officialImage,
          ownerId: parseInt(row.ownerId) || 0,
          areaInM2: parseFloat(row.areaInM2) || 0
        };
      }));
      
      return apartments;
    } catch (error) {
      console.error('Error fetching apartments by owner ID:', error);
      return [];
    }
  }

  public getGateAccessRelations(): GateAccessRelation[] {
    return ['Owner', 'Tenant', 'Family', 'Staff', 'Guest', 'Other'];
  }

  public async getGateAccessUsers(apartmentId: number): Promise<GateAccessUser[]> {
    try {
      const [rows] = await db.query(`
        SELECT u.id, u.username as name, u.email, u.phone, aga.relation,
               DATE_FORMAT(aga.expiry_date, '%Y-%m-%d') as expiryDate
        FROM apartment_gate_access aga
        JOIN users u ON aga.user_id = u.id
        WHERE aga.apartment_id = ?
        ORDER BY FIELD(aga.relation, 'Owner', 'Tenant', 'Family', 'Staff', 'Guest', 'Other'), u.username
      `, [apartmentId]);
      return (rows as any[]).map((row) => ({
        id: parseInt(row.id),
        name: row.name,
        email: row.email || undefined,
        phone: row.phone || undefined,
        relation: row.relation || 'Other',
        expiryDate: row.expiryDate || null
      }));
    } catch (error) {
      console.error('Error fetching gate access users:', error);
      return [];
    }
  }

  public async getGateAccessUsersByApartmentIds(apartmentIds: number[]): Promise<Map<number, GateAccessUser[]>> {
    const map = new Map<number, GateAccessUser[]>();
    if (apartmentIds.length === 0) {
      return map;
    }

    try {
      const placeholders = apartmentIds.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT aga.apartment_id as apartmentId, u.id, u.username as name, u.email, u.phone, aga.relation,
               DATE_FORMAT(aga.expiry_date, '%Y-%m-%d') as expiryDate
        FROM apartment_gate_access aga
        JOIN users u ON aga.user_id = u.id
        WHERE aga.apartment_id IN (${placeholders})
        ORDER BY u.username
      `, apartmentIds);

      for (const row of rows as any[]) {
        const aptId = parseInt(row.apartmentId);
        if (!map.has(aptId)) {
          map.set(aptId, []);
        }
        map.get(aptId)!.push({
          id: parseInt(row.id),
          name: row.name,
          email: row.email || undefined,
          phone: row.phone || undefined,
          relation: row.relation || 'Other',
          expiryDate: row.expiryDate || null
        });
      }
    } catch (error) {
      console.error('Error fetching gate access users by apartment IDs:', error);
    }

    return map;
  }

  public async upsertGateAccessUser(
    apartmentId: number,
    userId: number,
    relation: string,
    expiryDate?: string | null
  ): Promise<boolean> {
    try {
      const [userRows] = await db.query(`SELECT id FROM users WHERE id = ?`, [userId]);
      if ((userRows as any[]).length === 0) {
        return false;
      }
      const expiry = expiryDate && String(expiryDate).trim() ? String(expiryDate).trim() : null;
      await db.query(`
        INSERT INTO apartment_gate_access (apartment_id, user_id, relation, expiry_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE relation = VALUES(relation), expiry_date = VALUES(expiry_date)
      `, [apartmentId, userId, relation, expiry]);
      return true;
    } catch (error) {
      console.error('Error upserting gate access user:', error);
      return false;
    }
  }

  public async removeGateAccessUser(apartmentId: number, userId: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM apartment_gate_access
        WHERE apartment_id = ? AND user_id = ?
      `, [apartmentId, userId]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error removing gate access user:', error);
      return false;
    }
  }

  public async removeAllGateAccessForUser(userId: number): Promise<void> {
    await db.query(`DELETE FROM apartment_gate_access WHERE user_id = ?`, [userId]);
  }

  /**
   * Users who must not be deleted: current owners, or anyone in owner history
   * (that foreign key is ON DELETE RESTRICT).
   */
  public async getGateUserDeletionGuards(userIds: number[]): Promise<Map<number, 'owner' | 'history'>> {
    const guards = new Map<number, 'owner' | 'history'>();
    const ids = userIds.filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
      return guards;
    }

    const placeholders = ids.map(() => '?').join(',');
    const [ownerRows] = await db.query(
      `
      SELECT owner_id as userId FROM apartments WHERE owner_id IN (${placeholders})
      UNION
      SELECT user_id as userId FROM apartment_users WHERE role = 'owner' AND user_id IN (${placeholders})
      `,
      [...ids, ...ids]
    );
    for (const row of ownerRows as Array<{ userId: number }>) {
      guards.set(Number(row.userId), 'owner');
    }

    const [historyRows] = await db.query(
      `SELECT DISTINCT user_id as userId FROM apartment_owner_history WHERE user_id IN (${placeholders})`,
      ids
    );
    for (const row of historyRows as Array<{ userId: number }>) {
      const userId = Number(row.userId);
      if (!guards.has(userId)) {
        guards.set(userId, 'history');
      }
    }

    return guards;
  }

  public async syncDefaultGateAccess(
    apartmentId: number,
    ownerId: number | null,
    renterId: number | null
  ): Promise<void> {
    if (ownerId) {
      await this.upsertGateAccessUser(apartmentId, ownerId, 'Owner');
    }
    if (renterId) {
      await this.upsertGateAccessUser(apartmentId, renterId, 'Tenant');
    }
  }

  public async getExpiredGateAccess(): Promise<Array<{
    id: number;
    apartmentId: number;
    apartmentLabel: string;
    userId: number;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    relation: string;
    expiryDate: string;
  }>> {
    try {
      const [rows] = await db.query(`
        SELECT
          aga.id,
          a.id as apartmentId,
          CONCAT('Block ', COALESCE(a.floor, ''), ' ', COALESCE(a.apartment_number, ''), ' (', COALESCE(a.apartment_number_unofficial, ''), ')') as apartmentLabel,
          u.id as userId,
          u.username as userName,
          u.email as userEmail,
          u.phone as userPhone,
          aga.relation,
          DATE_FORMAT(aga.expiry_date, '%Y-%m-%d') as expiryDate
        FROM apartment_gate_access aga
        JOIN users u ON aga.user_id = u.id
        JOIN apartments a ON aga.apartment_id = a.id
        WHERE aga.expiry_date IS NOT NULL AND aga.expiry_date < CURDATE()
        ORDER BY aga.expiry_date ASC, a.floor, a.apartment_number, u.username
      `);
      return (rows as any[]).map((row) => ({
        id: parseInt(row.id),
        apartmentId: parseInt(row.apartmentId),
        apartmentLabel: row.apartmentLabel,
        userId: parseInt(row.userId),
        userName: row.userName,
        userEmail: row.userEmail || undefined,
        userPhone: row.userPhone || undefined,
        relation: row.relation || 'Other',
        expiryDate: row.expiryDate
      }));
    } catch (error) {
      console.error('Error fetching expired gate access:', error);
      return [];
    }
  }

  public async getMainGateAccessReport(filters?: {
    block?: string;
    unitNumber?: string;
    search?: string;
    relation?: string;
  }): Promise<Array<{
    id: number;
    userId: number;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    apartmentId: number;
    block: string;
    unitNumberOfficial: string;
    unitNumberUnofficial: string;
    relation: string;
    expiryDate?: string | null;
  }>> {
    try {
      let query = `
        SELECT
          aga.id,
          u.id as userId,
          u.username as userName,
          u.email as userEmail,
          u.phone as userPhone,
          a.id as apartmentId,
          a.floor as block,
          a.apartment_number as unitNumberOfficial,
          COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
          aga.relation,
          DATE_FORMAT(aga.expiry_date, '%Y-%m-%d') as expiryDate
        FROM apartment_gate_access aga
        JOIN users u ON aga.user_id = u.id
        JOIN apartments a ON aga.apartment_id = a.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters?.block) {
        query += ` AND a.floor = ?`;
        params.push(filters.block.trim().toUpperCase());
      }
      if (filters?.unitNumber) {
        query += ` AND a.apartment_number = ?`;
        params.push(filters.unitNumber.trim());
      }
      if (filters?.relation) {
        query += ` AND aga.relation = ?`;
        params.push(filters.relation.trim());
      }
      if (filters?.search) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (
          u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR
          a.apartment_number LIKE ? OR a.apartment_number_unofficial LIKE ?
        )`;
        params.push(term, term, term, term, term);
      }

      query += ` ORDER BY a.floor, a.apartment_number, FIELD(aga.relation, 'Owner', 'Tenant', 'Family', 'Staff', 'Guest', 'Other'), u.username`;

      const [rows] = await db.query(query, params);
      return (rows as any[]).map((row) => ({
        id: parseInt(row.id),
        userId: parseInt(row.userId),
        userName: row.userName,
        userEmail: row.userEmail || undefined,
        userPhone: row.userPhone || undefined,
        apartmentId: parseInt(row.apartmentId),
        block: row.block,
        unitNumberOfficial: row.unitNumberOfficial,
        unitNumberUnofficial: row.unitNumberUnofficial,
        relation: row.relation || 'Other',
        expiryDate: row.expiryDate || null
      }));
    } catch (error) {
      console.error('Error generating main gate access report:', error);
      return [];
    }
  }

  /** @deprecated Use upsertGateAccessUser / removeGateAccessUser instead */
  public async setGateAccessUsers(apartmentId: number, userIds: number[]): Promise<void> {
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM apartment_gate_access WHERE apartment_id = ?`, [apartmentId]);

      for (const userId of uniqueIds) {
        const [userRows] = await conn.query(`SELECT id FROM users WHERE id = ?`, [userId]);
        if ((userRows as any[]).length > 0) {
          await conn.query(`
            INSERT INTO apartment_gate_access (apartment_id, user_id, relation)
            VALUES (?, ?, 'Other')
          `, [apartmentId, userId]);
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      console.error('Error setting gate access users:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  public async getOwnerHistory(apartmentId: number): Promise<ApartmentOwnerHistoryEntry[]> {
    try {
      const [rows] = await db.query(`
        SELECT
          h.id,
          h.user_id as userId,
          u.username as ownerName,
          u.email as ownerEmail,
          DATE_FORMAT(h.start_date, '%Y-%m-%dT%TZ') as startDate,
          DATE_FORMAT(h.end_date, '%Y-%m-%dT%TZ') as endDate,
          cb.username as changedByName
        FROM apartment_owner_history h
        JOIN users u ON h.user_id = u.id
        LEFT JOIN users cb ON h.changed_by = cb.id
        WHERE h.apartment_id = ?
        ORDER BY h.start_date DESC, h.id DESC
      `, [apartmentId]);

      return (rows as any[]).map((row) => ({
        id: parseInt(row.id),
        userId: parseInt(row.userId),
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail || undefined,
        startDate: row.startDate,
        endDate: row.endDate || null,
        changedByName: row.changedByName || undefined
      }));
    } catch (error) {
      console.error('Error fetching owner history:', error);
      return [];
    }
  }

  public async getPreviousOwnersSummary(apartmentId: number): Promise<string> {
    const history = await this.getOwnerHistory(apartmentId);
    const past = history.filter((entry) => entry.endDate);
    if (past.length === 0) {
      return '';
    }
    return past.map((entry) => {
      const from = entry.startDate ? new Date(entry.startDate).toLocaleDateString() : '';
      const to = entry.endDate ? new Date(entry.endDate).toLocaleDateString() : '';
      return `${entry.ownerName} (${from} – ${to})`;
    }).join('; ');
  }

  private async recordOwnerChange(
    conn: mysql.PoolConnection,
    apartmentId: number,
    newOwnerId: number | null,
    changedBy?: number
  ): Promise<void> {
    await conn.query(`
      UPDATE apartment_owner_history
      SET end_date = NOW()
      WHERE apartment_id = ? AND end_date IS NULL
    `, [apartmentId]);

    let validChangedBy: number | null = null;
    if (changedBy) {
      const [changedByRows] = await conn.query(`SELECT id FROM users WHERE id = ?`, [changedBy]);
      if ((changedByRows as any[]).length > 0) {
        validChangedBy = changedBy;
      }
    }

    if (newOwnerId) {
      await conn.query(`
        INSERT INTO apartment_owner_history (apartment_id, user_id, start_date, end_date, changed_by)
        VALUES (?, ?, NOW(), NULL, ?)
      `, [apartmentId, newOwnerId, validChangedBy]);
    }
  }
}

export const apartmentsService = ApartmentsService.getInstance();
