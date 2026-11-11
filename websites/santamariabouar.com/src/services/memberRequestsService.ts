import { db } from '../config/database';
import { usersService } from '../../admin/services/usersService';
import { apartmentsService } from '../../admin/services/apartmentsService';
import { safegateService, safemateAccountFromPhone } from './safegateService';

export interface ListingRequestDetails {
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
}

export interface ListingRequest extends ListingRequestDetails {
  id: number;
  apartmentId: number;
  userId: number;
  requestType: 'for_sale' | 'for_rent';
  description?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  apartmentLabel?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  ownerName?: string;
  ownerEmail?: string;
  approvedPhotoCount?: number;
}

export interface GateAccessRequest {
  id: number;
  apartmentId: number;
  userId: number;
  action: 'add' | 'remove';
  targetUserId?: number | null;
  targetName?: string | null;
  targetPhone?: string | null;
  targetEmail?: string | null;
  relation?: string | null;
  expiryDate?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  apartmentLabel?: string;
  ownerName?: string;
}

function apartmentLabelSql(alias = 'a'): string {
  return `CONCAT('Block ', COALESCE(${alias}.floor, ''), ' ', COALESCE(${alias}.apartment_number, ''), ' (', COALESCE(${alias}.apartment_number_unofficial, ''), ')')`;
}

const LISTING_REQUEST_SELECT = `
  lr.price_usd as priceUsd,
  lr.price_negotiable as priceNegotiable,
  lr.contact_for_price as contactForPrice,
  lr.is_furnished as isFurnished,
  lr.parking_spaces as parkingSpaces,
  lr.bedrooms,
  lr.bathrooms,
  lr.has_garden as hasGarden,
  lr.has_terrace as hasTerrace,
  lr.has_balcony as hasBalcony,
  lr.has_storage_room as hasStorageRoom,
  DATE_FORMAT(lr.availability_date, '%Y-%m-%d') as availabilityDate,
  lr.pet_friendly as petFriendly
`;

function mapListingRequestRow(row: Record<string, unknown>): ListingRequest {
  return {
    id: parseInt(String(row.id), 10),
    apartmentId: parseInt(String(row.apartmentId), 10),
    userId: parseInt(String(row.userId), 10),
    requestType: row.requestType as 'for_sale' | 'for_rent',
    description: (row.description as string) || null,
    status: row.status as ListingRequest['status'],
    createdAt: String(row.createdAt),
    reviewedBy: row.reviewedBy ? parseInt(String(row.reviewedBy), 10) : null,
    reviewedAt: (row.reviewedAt as string) || null,
    apartmentLabel: row.apartmentLabel as string | undefined,
    requesterName: row.requesterName as string | undefined,
    requesterEmail: row.requesterEmail as string | undefined,
    requesterPhone: row.requesterPhone as string | undefined,
    ownerName: row.ownerName as string | undefined,
    ownerEmail: row.ownerEmail as string | undefined,
    approvedPhotoCount: row.approvedPhotoCount != null
      ? parseInt(String(row.approvedPhotoCount), 10)
      : undefined,
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
    petFriendly: row.petFriendly == null ? null : Boolean(row.petFriendly)
  };
}

export class MemberRequestsService {
  public async createListingRequest(data: {
    apartmentId: number;
    userId: number;
    requestType: 'for_sale' | 'for_rent';
    description: string;
  } & ListingRequestDetails): Promise<number> {
    const [existing] = await db.query(`
      SELECT id FROM listing_requests
      WHERE apartment_id = ? AND user_id = ? AND status = 'pending'
      LIMIT 1
    `, [data.apartmentId, data.userId]);

    const values = [
      data.description,
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
      data.requestType
    ];

    if ((existing as { id: number }[]).length > 0) {
      const existingId = parseInt(String((existing as { id: number }[])[0].id), 10);
      await db.query(`
        UPDATE listing_requests
        SET description = ?,
            price_usd = ?,
            price_negotiable = ?,
            contact_for_price = ?,
            is_furnished = ?,
            parking_spaces = ?,
            bedrooms = ?,
            bathrooms = ?,
            has_garden = ?,
            has_terrace = ?,
            has_balcony = ?,
            has_storage_room = ?,
            availability_date = ?,
            pet_friendly = ?,
            request_type = ?
        WHERE id = ?
      `, [...values, existingId]);
      return existingId;
    }

    const [result] = await db.query(`
      INSERT INTO listing_requests (
        apartment_id, user_id, request_type, description,
        price_usd, price_negotiable, contact_for_price,
        is_furnished, parking_spaces, bedrooms, bathrooms,
        has_garden, has_terrace, has_balcony, has_storage_room,
        availability_date, pet_friendly, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      data.apartmentId,
      data.userId,
      data.requestType,
      ...values
    ]);

    return (result as any).insertId;
  }

  public async cancelPendingListingRequests(apartmentId: number): Promise<void> {
    await db.query(`
      UPDATE listing_requests
      SET status = 'rejected', reviewed_at = NOW()
      WHERE apartment_id = ? AND status = 'pending'
    `, [apartmentId]);
  }

  public async getListingRequests(status?: string): Promise<ListingRequest[]> {
    let query = `
      SELECT
        lr.id,
        lr.apartment_id as apartmentId,
        lr.user_id as userId,
        lr.request_type as requestType,
        lr.description,
        lr.status,
        DATE_FORMAT(lr.created_at, '%Y-%m-%dT%TZ') as createdAt,
        lr.reviewed_by as reviewedBy,
        DATE_FORMAT(lr.reviewed_at, '%Y-%m-%dT%TZ') as reviewedAt,
        ${LISTING_REQUEST_SELECT},
        ${apartmentLabelSql('a')} as apartmentLabel,
        requester.username as requesterName,
        requester.email as requesterEmail,
        requester.phone as requesterPhone,
        owner.username as ownerName,
        owner.email as ownerEmail,
        (
          SELECT COUNT(*) FROM apartment_images ai
          WHERE ai.apartment_id = lr.apartment_id
            AND (ai.status = 'approved' OR ai.status IS NULL)
        ) as approvedPhotoCount
      FROM listing_requests lr
      INNER JOIN apartments a ON a.id = lr.apartment_id
      INNER JOIN users requester ON requester.id = lr.user_id
      LEFT JOIN users owner ON owner.id = a.owner_id
    `;
    const params: unknown[] = [];
    if (status) {
      query += ` WHERE lr.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY lr.created_at DESC`;

    const [rows] = await db.query(query, params);
    return (rows as Record<string, unknown>[]).map(mapListingRequestRow);
  }

  public async getListingRequestById(id: number): Promise<ListingRequest | null> {
    const [rows] = await db.query(`
      SELECT
        lr.id,
        lr.apartment_id as apartmentId,
        lr.user_id as userId,
        lr.request_type as requestType,
        lr.description,
        lr.status,
        DATE_FORMAT(lr.created_at, '%Y-%m-%dT%TZ') as createdAt,
        lr.reviewed_by as reviewedBy,
        DATE_FORMAT(lr.reviewed_at, '%Y-%m-%dT%TZ') as reviewedAt,
        ${LISTING_REQUEST_SELECT},
        ${apartmentLabelSql('a')} as apartmentLabel,
        requester.username as requesterName,
        requester.email as requesterEmail,
        requester.phone as requesterPhone,
        owner.username as ownerName,
        owner.email as ownerEmail,
        (
          SELECT COUNT(*) FROM apartment_images ai
          WHERE ai.apartment_id = lr.apartment_id
            AND (ai.status = 'approved' OR ai.status IS NULL)
        ) as approvedPhotoCount
      FROM listing_requests lr
      INNER JOIN apartments a ON a.id = lr.apartment_id
      INNER JOIN users requester ON requester.id = lr.user_id
      LEFT JOIN users owner ON owner.id = a.owner_id
      WHERE lr.id = ?
    `, [id]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapListingRequestRow(row) : null;
  }

  public async reviewListingRequest(
    id: number,
    status: 'approved' | 'rejected',
    reviewedBy: number
  ): Promise<ListingRequest | null> {
    await db.query(`
      UPDATE listing_requests
      SET status = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ? AND status = 'pending'
    `, [status, reviewedBy || null, id]);
    return this.getListingRequestById(id);
  }

  public async getPendingListingForApartment(apartmentId: number): Promise<ListingRequest | null> {
    const [rows] = await db.query(`
      SELECT
        lr.id,
        lr.apartment_id as apartmentId,
        lr.user_id as userId,
        lr.request_type as requestType,
        lr.description,
        lr.status,
        DATE_FORMAT(lr.created_at, '%Y-%m-%dT%TZ') as createdAt,
        ${LISTING_REQUEST_SELECT}
      FROM listing_requests lr
      WHERE lr.apartment_id = ? AND lr.status = 'pending'
      ORDER BY lr.created_at DESC
      LIMIT 1
    `, [apartmentId]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapListingRequestRow(row) : null;
  }

  public async createGateAccessRequest(data: {
    apartmentId: number;
    userId: number;
    action: 'add' | 'remove';
    targetUserId?: number | null;
    targetName?: string | null;
    targetPhone?: string | null;
    targetEmail?: string | null;
    relation?: string | null;
    expiryDate?: string | null;
  }): Promise<number> {
    const expiry = data.expiryDate && String(data.expiryDate).trim() ? String(data.expiryDate).trim() : null;
    const [result] = await db.query(`
      INSERT INTO gate_access_requests
        (apartment_id, user_id, action, target_user_id, target_name, target_phone, target_email, relation, expiry_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      data.apartmentId,
      data.userId,
      data.action,
      data.targetUserId || null,
      data.targetName || null,
      data.targetPhone || null,
      data.targetEmail || null,
      data.relation || null,
      expiry
    ]);
    return (result as any).insertId;
  }

  public async getGateAccessRequests(status?: string): Promise<GateAccessRequest[]> {
    let query = `
      SELECT
        gar.id,
        gar.apartment_id as apartmentId,
        gar.user_id as userId,
        gar.action,
        gar.target_user_id as targetUserId,
        gar.target_name as targetName,
        gar.target_phone as targetPhone,
        gar.target_email as targetEmail,
        gar.relation,
        DATE_FORMAT(gar.expiry_date, '%Y-%m-%d') as expiryDate,
        gar.status,
        DATE_FORMAT(gar.created_at, '%Y-%m-%dT%TZ') as createdAt,
        gar.reviewed_by as reviewedBy,
        DATE_FORMAT(gar.reviewed_at, '%Y-%m-%dT%TZ') as reviewedAt,
        ${apartmentLabelSql('a')} as apartmentLabel,
        u.username as ownerName
      FROM gate_access_requests gar
      INNER JOIN apartments a ON a.id = gar.apartment_id
      INNER JOIN users u ON u.id = gar.user_id
    `;
    const params: unknown[] = [];
    if (status) {
      query += ` WHERE gar.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY gar.created_at DESC`;

    const [rows] = await db.query(query, params);
    return (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      id: parseInt(String(row.id), 10),
      apartmentId: parseInt(String(row.apartmentId), 10),
      userId: parseInt(String(row.userId), 10),
      targetUserId: row.targetUserId ? parseInt(String(row.targetUserId), 10) : null,
      reviewedBy: row.reviewedBy ? parseInt(String(row.reviewedBy), 10) : null
    })) as GateAccessRequest[];
  }

  public async getGateAccessRequestById(id: number): Promise<GateAccessRequest | null> {
    const [rows] = await db.query(`
      SELECT
        gar.id,
        gar.apartment_id as apartmentId,
        gar.user_id as userId,
        gar.action,
        gar.target_user_id as targetUserId,
        gar.target_name as targetName,
        gar.target_phone as targetPhone,
        gar.target_email as targetEmail,
        gar.relation,
        DATE_FORMAT(gar.expiry_date, '%Y-%m-%d') as expiryDate,
        gar.status,
        DATE_FORMAT(gar.created_at, '%Y-%m-%dT%TZ') as createdAt,
        gar.reviewed_by as reviewedBy,
        DATE_FORMAT(gar.reviewed_at, '%Y-%m-%dT%TZ') as reviewedAt,
        ${apartmentLabelSql('a')} as apartmentLabel,
        u.username as ownerName
      FROM gate_access_requests gar
      INNER JOIN apartments a ON a.id = gar.apartment_id
      INNER JOIN users u ON u.id = gar.user_id
      WHERE gar.id = ?
    `, [id]);
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) return null;
    return {
      ...row,
      id: parseInt(String(row.id), 10),
      apartmentId: parseInt(String(row.apartmentId), 10),
      userId: parseInt(String(row.userId), 10),
      targetUserId: row.targetUserId ? parseInt(String(row.targetUserId), 10) : null,
      reviewedBy: row.reviewedBy ? parseInt(String(row.reviewedBy), 10) : null
    } as GateAccessRequest;
  }

  /**
   * Grant a website "add" request immediately.
   * An existing CMS or SafeMate account is reused and is not treated as a failure.
   */
  public async acceptNewGateAccessRequest(data: {
    requestId: number;
    apartmentId: number;
    targetName: string;
    targetPhone: string;
    targetEmail?: string | null;
    relation?: string | null;
    expiryDate?: string | null;
  }): Promise<{
    ok: boolean;
    alreadyExisted: boolean;
    loginPhone: string;
    errorMessage?: string;
    cloudWarning?: string;
  }> {
    const phone = String(data.targetPhone || '').trim();
    const email = String(data.targetEmail || '').trim();
    const name = String(data.targetName || '').trim() || 'Gate Access User';
    const relation = String(data.relation || '').trim() || 'Guest';
    const expiryDate = data.expiryDate && String(data.expiryDate).trim() ? String(data.expiryDate).trim() : null;
    const loginPhone = safemateAccountFromPhone(phone) || phone;

    let existingUser = await usersService.getUserByPhone(phone);
    let alreadyExisted = Boolean(existingUser);
    if (!existingUser && email) {
      existingUser = await usersService.getUserByEmail(email);
      if (existingUser) {
        alreadyExisted = true;
      }
    }

    let userId = existingUser?.id || 0;
    if (!userId) {
      try {
        const created = await usersService.createUser({
          name,
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          status: 'Active',
          role: 'Member'
        });
        userId = created.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already exists/i.test(message)) {
          alreadyExisted = true;
          const again = (await usersService.getUserByPhone(phone))
            || (email ? await usersService.getUserByEmail(email) : null);
          userId = again?.id || 0;
        } else {
          return { ok: false, alreadyExisted: false, loginPhone, errorMessage: message };
        }
      }
    }

    if (!userId) {
      return {
        ok: false,
        alreadyExisted,
        loginPhone,
        errorMessage: 'Could not find or create the gate access account.'
      };
    }

    const saved = await apartmentsService.upsertGateAccessUser(
      data.apartmentId,
      userId,
      relation,
      expiryDate
    );
    if (!saved) {
      return {
        ok: false,
        alreadyExisted,
        loginPhone,
        errorMessage: 'Could not save gate access for this apartment.'
      };
    }

    const cloud = await safegateService.grantAccess({
      phone,
      email: email || null,
      name,
      expiryDate
    });
    if (cloud.alreadyExisted) {
      alreadyExisted = true;
    }
    if (!cloud.ok && !cloud.alreadyExisted) {
      return {
        ok: false,
        alreadyExisted: false,
        loginPhone,
        errorMessage: cloud.message || 'SafeMate could not grant access.'
      };
    }

    await this.reviewGateAccessRequest(data.requestId, 'approved', 0);
    return {
      ok: true,
      alreadyExisted,
      loginPhone,
      cloudWarning: cloud.alreadyExisted && !cloud.ok
        ? (cloud.message || 'SafeMate account already existed and the gate could not be confirmed.')
        : undefined
    };
  }

  public async reviewGateAccessRequest(
    id: number,
    status: 'approved' | 'rejected',
    reviewedBy: number
  ): Promise<GateAccessRequest | null> {
    await db.query(`
      UPDATE gate_access_requests
      SET status = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ? AND status = 'pending'
    `, [status, reviewedBy || null, id]);
    return this.getGateAccessRequestById(id);
  }

  public async getPendingGateRequestsForApartment(apartmentId: number): Promise<GateAccessRequest[]> {
    return this.getPendingGateRequestsForApartments([apartmentId]);
  }

  public async getPendingGateRequestsForApartments(apartmentIds: number[]): Promise<GateAccessRequest[]> {
    if (apartmentIds.length === 0) {
      return [];
    }

    const placeholders = apartmentIds.map(() => '?').join(',');
    const [rows] = await db.query(`
      SELECT
        gar.id,
        gar.apartment_id as apartmentId,
        gar.user_id as userId,
        gar.action,
        gar.target_user_id as targetUserId,
        gar.target_name as targetName,
        gar.target_phone as targetPhone,
        gar.target_email as targetEmail,
        gar.relation,
        DATE_FORMAT(gar.expiry_date, '%Y-%m-%d') as expiryDate,
        gar.status,
        DATE_FORMAT(gar.created_at, '%Y-%m-%dT%TZ') as createdAt,
        ${apartmentLabelSql('a')} as apartmentLabel
      FROM gate_access_requests gar
      INNER JOIN apartments a ON a.id = gar.apartment_id
      WHERE gar.apartment_id IN (${placeholders}) AND gar.status = 'pending'
      ORDER BY gar.created_at DESC
    `, apartmentIds);

    return (rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      id: parseInt(String(row.id), 10),
      apartmentId: parseInt(String(row.apartmentId), 10),
      userId: parseInt(String(row.userId), 10),
      targetUserId: row.targetUserId ? parseInt(String(row.targetUserId), 10) : null
    })) as GateAccessRequest[];
  }
}

export const memberRequestsService = new MemberRequestsService();
