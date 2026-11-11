import crypto from 'crypto';
import { db } from '../config/database';

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 1;

export interface PasswordResetTokenRow {
  id: number;
  userId: number;
  expiresAt: Date;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class PasswordResetService {
  /**
   * Invalidate prior unused tokens, create a new one, return the raw token for emailing.
   */
  public async createResetToken(userId: number): Promise<string> {
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(rawToken);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = ? AND used_at IS NULL
        `,
        [userId]
      );

      await conn.query(
        `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
        `,
        [userId, tokenHash, TOKEN_TTL_HOURS]
      );

      await conn.commit();
      return rawToken;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Look up a still-valid unused token without consuming it (for GET reset form).
   */
  public async findValidToken(rawToken: string): Promise<PasswordResetTokenRow | null> {
    const trimmed = (rawToken || '').trim();
    if (!trimmed) {
      return null;
    }

    const tokenHash = hashToken(trimmed);
    const [rows] = await db.query(
      `
      SELECT id, user_id as userId, expires_at as expiresAt
      FROM password_reset_tokens
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    const row = (rows as any[])[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      userId: Number(row.userId),
      expiresAt: row.expiresAt
    };
  }

  /**
   * Validate and mark token as used. Returns userId on success, null otherwise.
   */
  public async consumeValidToken(rawToken: string): Promise<number | null> {
    const trimmed = (rawToken || '').trim();
    if (!trimmed) {
      return null;
    }

    const tokenHash = hashToken(trimmed);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `
        SELECT id, user_id as userId
        FROM password_reset_tokens
        WHERE token_hash = ?
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        FOR UPDATE
        `,
        [tokenHash]
      );

      const row = (rows as any[])[0];
      if (!row) {
        await conn.rollback();
        return null;
      }

      await conn.query(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = ?
        `,
        [row.id]
      );

      await conn.commit();
      return Number(row.userId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

export const passwordResetService = new PasswordResetService();
