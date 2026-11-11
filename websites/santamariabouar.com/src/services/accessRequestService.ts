import { db } from '../config/database';

export type AccessRequestApartmentRole = 'owner' | 'tenant';

export interface AccessRequest {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  apartments: Array<{
    id: number;
    label: string;
    block: string;
    unitNumberOfficial: string;
    unitNumberUnofficial: string;
    ownerId: number | null;
    ownerName: string | null;
    role: AccessRequestApartmentRole;
  }>;
}

export class AccessRequestService {
  public async createRequest(data: {
    fullName: string;
    email: string;
    phone: string;
    apartments: Array<{ apartmentId: number; role: AccessRequestApartmentRole }>;
  }): Promise<number> {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO access_requests (full_name, email, phone) VALUES (?, ?, ?)`,
        [data.fullName.trim(), data.email.trim().toLowerCase(), data.phone.trim()]
      );
      const requestId = (result as any).insertId as number;

      const seen = new Set<number>();
      for (const entry of data.apartments) {
        const apartmentId = entry.apartmentId;
        if (!Number.isFinite(apartmentId) || apartmentId <= 0 || seen.has(apartmentId)) continue;
        seen.add(apartmentId);
        const role = entry.role === 'tenant' ? 'tenant' : 'owner';
        await conn.query(
          `INSERT INTO access_request_apartments (request_id, apartment_id, role) VALUES (?, ?, ?)`,
          [requestId, apartmentId, role]
        );
      }

      await conn.commit();
      return requestId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  public async getAllRequests(): Promise<AccessRequest[]> {
    const [rows] = await db.query(`
      SELECT
        id,
        full_name as fullName,
        email,
        phone,
        DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
      FROM access_requests
      ORDER BY created_at DESC
    `);

    const requests: AccessRequest[] = [];
    for (const row of rows as any[]) {
      requests.push({
        id: parseInt(row.id),
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        createdAt: row.createdAt,
        apartments: await this.getRequestApartments(parseInt(row.id))
      });
    }
    return requests;
  }

  public async getRequestById(id: number): Promise<AccessRequest | null> {
    const [rows] = await db.query(`
      SELECT
        id,
        full_name as fullName,
        email,
        phone,
        DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
      FROM access_requests
      WHERE id = ?
    `, [id]);
    const row = (rows as any[])[0];
    if (!row) return null;
    return {
      id: parseInt(row.id),
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt,
      apartments: await this.getRequestApartments(parseInt(row.id))
    };
  }

  public async getRequestApartments(requestId: number): Promise<AccessRequest['apartments']> {
    const [rows] = await db.query(`
      SELECT
        a.id,
        a.floor as block,
        a.apartment_number as unitNumberOfficial,
        a.apartment_number_unofficial as unitNumberUnofficial,
        a.owner_id as ownerId,
        COALESCE(u.username, a.owner_name) as ownerName,
        COALESCE(ara.role, 'owner') as role,
        CONCAT('Block ', COALESCE(a.floor, ''), ' ', COALESCE(a.apartment_number, ''), ' (', COALESCE(a.apartment_number_unofficial, ''), ')') as label
      FROM access_request_apartments ara
      INNER JOIN apartments a ON a.id = ara.apartment_id
      LEFT JOIN users u ON u.id = a.owner_id
      WHERE ara.request_id = ?
      ORDER BY a.floor, a.apartment_number
    `, [requestId]);

    return (rows as any[]).map((row) => ({
      id: parseInt(row.id),
      label: row.label,
      block: row.block,
      unitNumberOfficial: row.unitNumberOfficial,
      unitNumberUnofficial: row.unitNumberUnofficial,
      ownerId: row.ownerId ? parseInt(row.ownerId) : null,
      ownerName: row.ownerName || null,
      role: (row.role === 'tenant' ? 'tenant' : 'owner') as AccessRequestApartmentRole
    }));
  }

  public async deleteRequest(id: number): Promise<boolean> {
    const [result] = await db.query(`DELETE FROM access_requests WHERE id = ?`, [id]);
    return (result as any).affectedRows > 0;
  }

  public async hasPendingEmail(email: string): Promise<boolean> {
    const [rows] = await db.query(
      `SELECT id FROM access_requests WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [email]
    );
    return (rows as any[]).length > 0;
  }

  public async getPendingTenantRequestForApartment(apartmentId: number): Promise<AccessRequest | null> {
    const [rows] = await db.query(
      `
      SELECT ar.id
      FROM access_request_apartments ara
      INNER JOIN access_requests ar ON ar.id = ara.request_id
      WHERE ara.apartment_id = ? AND ara.role = 'tenant'
      ORDER BY ar.created_at DESC
      LIMIT 1
      `,
      [apartmentId]
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    return this.getRequestById(parseInt(row.id, 10));
  }
}

export const accessRequestService = new AccessRequestService();
