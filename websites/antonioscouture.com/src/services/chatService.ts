import db from '../config/database';

export const CHAT_MAX_BODY = 4000;

export interface ChatConversationRow {
  id: number;
  public_key: string;
  visitor_first_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
}

export interface ChatConversationWithUnread extends ChatConversationRow {
  unread_count: number;
}

export interface ChatMessageRow {
  id: number;
  conversation_id: number;
  sender: 'visitor' | 'staff';
  staff_user_id: number | null;
  body: string;
  created_at: Date;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicChatKey(publicKey: string): boolean {
  return typeof publicKey === 'string' && uuidRe.test(publicKey.trim());
}

export function sanitizeContact(
  s: string | undefined | null,
  max: number
): string | null {
  if (s == null || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export class ChatService {
  private static instance: ChatService;

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async findByPublicKey(publicKey: string): Promise<ChatConversationRow | null> {
    const [rows] = await db.query(
      `SELECT id, public_key, visitor_first_name, visitor_email, visitor_phone,
              created_at, updated_at, last_message_at
       FROM chat_conversations WHERE public_key = ? LIMIT 1`,
      [publicKey]
    );
    const list = rows as ChatConversationRow[];
    return list[0] ?? null;
  }

  async listConversations(limit = 200): Promise<ChatConversationRow[]> {
    const [rows] = await db.query(
      `SELECT id, public_key, visitor_first_name, visitor_email, visitor_phone,
              created_at, updated_at, last_message_at
       FROM chat_conversations
       ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC
       LIMIT ?`,
      [limit]
    );
    return rows as ChatConversationRow[];
  }

  /**
   * Conversations for admin list with per-staff unread visitor message counts.
   */
  async listConversationsForStaff(
    staffUserId: number,
    limit = 200
  ): Promise<ChatConversationWithUnread[]> {
    const [rows] = await db.query(
      `SELECT c.id, c.public_key, c.visitor_first_name, c.visitor_email, c.visitor_phone,
              c.created_at, c.updated_at, c.last_message_at,
              (
                SELECT COUNT(*)
                FROM chat_messages m
                WHERE m.conversation_id = c.id
                  AND m.sender = 'visitor'
                  AND m.id > COALESCE(
                    (SELECT r.last_read_message_id
                     FROM chat_conversation_reads r
                     WHERE r.conversation_id = c.id AND r.staff_user_id = ?
                     LIMIT 1),
                    0
                  )
              ) AS unread_count
       FROM chat_conversations c
       ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
       LIMIT ?`,
      [staffUserId, limit]
    );
    return (rows as (ChatConversationRow & { unread_count: number })[]).map((r) => ({
      ...r,
      unread_count: Number(r.unread_count ?? 0),
    }));
  }

  async getTotalUnreadCount(staffUserId: number): Promise<number> {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(unread_cnt), 0) AS total
       FROM (
         SELECT (
           SELECT COUNT(*)
           FROM chat_messages m
           WHERE m.conversation_id = c.id
             AND m.sender = 'visitor'
             AND m.id > COALESCE(
               (SELECT r.last_read_message_id
                FROM chat_conversation_reads r
                WHERE r.conversation_id = c.id AND r.staff_user_id = ?
                LIMIT 1),
               0
             )
         ) AS unread_cnt
         FROM chat_conversations c
       ) AS counts`,
      [staffUserId]
    );
    const row = (rows as { total: number }[])[0];
    return Number(row?.total ?? 0);
  }

  /** Mark all messages in a conversation read for this staff user. */
  async markConversationRead(staffUserId: number, conversationId: number): Promise<void> {
    const [maxRows] = await db.query(
      `SELECT COALESCE(MAX(id), 0) AS max_id FROM chat_messages WHERE conversation_id = ?`,
      [conversationId]
    );
    const maxId = Number((maxRows as { max_id: number }[])[0]?.max_id ?? 0);
    await db.query(
      `INSERT INTO chat_conversation_reads (staff_user_id, conversation_id, last_read_message_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_read_message_id = GREATEST(last_read_message_id, VALUES(last_read_message_id)),
         updated_at = CURRENT_TIMESTAMP`,
      [staffUserId, conversationId, maxId]
    );
  }

  async countMessages(conversationId: number): Promise<number> {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM chat_messages WHERE conversation_id = ?`,
      [conversationId]
    );
    const row = (rows as { cnt: number }[])[0];
    return Number(row?.cnt ?? 0);
  }

  async getMessages(conversationId: number): Promise<ChatMessageRow[]> {
    const [rows] = await db.query(
      `SELECT id, conversation_id, sender, staff_user_id, body, created_at
       FROM chat_messages WHERE conversation_id = ?
       ORDER BY id ASC`,
      [conversationId]
    );
    return rows as ChatMessageRow[];
  }

  /**
   * Creates conversation row with optional contact; used when visitor sends first message.
   */
  async createConversation(
    publicKey: string,
    contact: { firstName?: string | null; email?: string | null; phone?: string | null }
  ): Promise<number> {
    const fn = sanitizeContact(contact.firstName ?? null, 255);
    const em = sanitizeContact(contact.email ?? null, 255);
    const ph = sanitizeContact(contact.phone ?? null, 64);
    const [result] = await db.query<{ insertId: number }>(
      `INSERT INTO chat_conversations (public_key, visitor_first_name, visitor_email, visitor_phone)
       VALUES (?, ?, ?, ?)`,
      [publicKey, fn, em, ph]
    );
    return (result as any).insertId as number;
  }

  async mergeContact(
    publicKey: string,
    contact: { firstName?: string | null; email?: string | null; phone?: string | null }
  ): Promise<void> {
    const fn = sanitizeContact(contact.firstName ?? null, 255);
    const em = sanitizeContact(contact.email ?? null, 255);
    const ph = sanitizeContact(contact.phone ?? null, 64);
    if (fn === null && em === null && ph === null) return;

    const parts: string[] = [];
    const vals: (string | number)[] = [];
    if (fn !== null) {
      parts.push('visitor_first_name = ?');
      vals.push(fn);
    }
    if (em !== null) {
      parts.push('visitor_email = ?');
      vals.push(em);
    }
    if (ph !== null) {
      parts.push('visitor_phone = ?');
      vals.push(ph);
    }
    if (parts.length === 0) return;
    vals.push(publicKey);
    await db.query(
      `UPDATE chat_conversations SET ${parts.join(', ')} WHERE public_key = ?`,
      vals
    );
  }

  async addVisitorMessage(conversationId: number, body: string): Promise<ChatMessageRow> {
    const [result] = await db.query(
      `INSERT INTO chat_messages (conversation_id, sender, body) VALUES (?, 'visitor', ?)`,
      [conversationId, body]
    );
    const id = (result as any).insertId as number;
    await db.query(
      `UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [conversationId]
    );
    const [msgs] = await db.query(
      `SELECT id, conversation_id, sender, staff_user_id, body, created_at FROM chat_messages WHERE id = ?`,
      [id]
    );
    const list = msgs as ChatMessageRow[];
    if (!list[0]) {
      throw new Error('addVisitorMessage: row not found after insert');
    }
    return list[0];
  }

  async addStaffMessage(
    conversationId: number,
    staffUserId: number,
    body: string
  ): Promise<ChatMessageRow> {
    const [result] = await db.query(
      `INSERT INTO chat_messages (conversation_id, sender, staff_user_id, body)
       VALUES (?, 'staff', ?, ?)`,
      [conversationId, staffUserId, body]
    );
    const id = (result as any).insertId as number;
    await db.query(
      `UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [conversationId]
    );
    const [msgs] = await db.query(
      `SELECT id, conversation_id, sender, staff_user_id, body, created_at FROM chat_messages WHERE id = ?`,
      [id]
    );
    const list = msgs as ChatMessageRow[];
    if (!list[0]) {
      throw new Error('addStaffMessage: row not found after insert');
    }
    return list[0];
  }
}
