import { db } from '../config/database';

export type GateOpenStatus = 'success' | 'failed';

export interface GateOpenLogEntry {
  id: number;
  userId: number | null;
  userName: string;
  userEmail: string | null;
  userPhone: string | null;
  status: GateOpenStatus;
  errorMessage: string | null;
  host: string | null;
  ipAddress: string | null;
  impersonatorId: number | null;
  impersonatorName: string | null;
  openedAt: string;
}

export interface GateOpenLogFilters {
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface InsertGateOpenLogInput {
  userId: number | null;
  userName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  status: GateOpenStatus;
  errorMessage?: string | null;
  host?: string | null;
  ipAddress?: string | null;
  impersonatorId?: number | null;
  impersonatorName?: string | null;
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export class GateOpenLogService {
  async insert(entry: InsertGateOpenLogInput): Promise<void> {
    await db.query(
      `INSERT INTO gate_open_logs (
         user_id, user_name, user_email, user_phone,
         status, error_message, host, ip_address,
         impersonator_id, impersonator_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.userName,
        entry.userEmail || null,
        entry.userPhone || null,
        entry.status,
        entry.errorMessage ? entry.errorMessage.slice(0, 500) : null,
        entry.host || null,
        entry.ipAddress || null,
        entry.impersonatorId || null,
        entry.impersonatorName || null
      ]
    );
  }

  async list(filters: GateOpenLogFilters = {}): Promise<GateOpenLogEntry[]> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    const search = String(filters.search || '').trim();
    if (search) {
      const like = `%${search}%`;
      where.push('(user_name LIKE ? OR user_email LIKE ? OR user_phone LIKE ?)');
      params.push(like, like, like);
    }

    const fromDate = String(filters.fromDate || '').trim();
    if (fromDate && isYmd(fromDate)) {
      where.push('opened_at >= ?');
      params.push(`${fromDate} 00:00:00`);
    }

    const toDate = String(filters.toDate || '').trim();
    if (toDate && isYmd(toDate)) {
      where.push('opened_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(toDate);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT
         id,
         user_id AS userId,
         user_name AS userName,
         user_email AS userEmail,
         user_phone AS userPhone,
         status,
         error_message AS errorMessage,
         host,
         ip_address AS ipAddress,
         impersonator_id AS impersonatorId,
         impersonator_name AS impersonatorName,
         DATE_FORMAT(opened_at, '%Y-%m-%dT%T') AS openedAt
       FROM gate_open_logs
       ${whereSql}
       ORDER BY opened_at DESC, id DESC
       LIMIT 500`,
      params
    );

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      userId: row.userId == null ? null : Number(row.userId),
      userName: String(row.userName || ''),
      userEmail: row.userEmail ? String(row.userEmail) : null,
      userPhone: row.userPhone ? String(row.userPhone) : null,
      status: row.status === 'success' ? 'success' : 'failed',
      errorMessage: row.errorMessage ? String(row.errorMessage) : null,
      host: row.host ? String(row.host) : null,
      ipAddress: row.ipAddress ? String(row.ipAddress) : null,
      impersonatorId: row.impersonatorId == null ? null : Number(row.impersonatorId),
      impersonatorName: row.impersonatorName ? String(row.impersonatorName) : null,
      openedAt: String(row.openedAt || '')
    }));
  }
}

export const gateOpenLogService = new GateOpenLogService();
