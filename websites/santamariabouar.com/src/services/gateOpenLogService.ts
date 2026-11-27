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

export interface GateOpenLogPage {
  rows: GateOpenLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 100;

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

function buildWhere(filters: GateOpenLogFilters): { whereSql: string; params: Array<string | number> } {
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

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

function mapRow(row: Record<string, unknown>): GateOpenLogEntry {
  return {
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
  };
}

const LIST_SQL = `SELECT
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
       FROM gate_open_logs`;

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

  async list(filters: GateOpenLogFilters = {}, requestedPage = 1): Promise<GateOpenLogPage> {
    const { whereSql, params } = buildWhere(filters);
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM gate_open_logs ${whereSql}`,
      params
    );
    const total = Number((countRows as Array<{ total?: unknown }>)[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages);

    if (total === 0) {
      return { rows: [], page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };
    }

    const offset = (page - 1) * PAGE_SIZE;
    const [rows] = await db.query(
      `${LIST_SQL}
       ${whereSql}
       ORDER BY opened_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );

    return {
      rows: (rows as Array<Record<string, unknown>>).map(mapRow),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages
    };
  }
}

export const gateOpenLogService = new GateOpenLogService();
