import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../../config/database';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_BYTES = 48;
const JWT_ISSUER = 'santamariabouar-api';
const DEV_JWT_SECRET = 'smb-dev-jwt-secret-local-only';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

export interface AccessTokenClaims {
  userId: number;
  role: string;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Returns null when the API cannot sign tokens (production without a strong JWT_SECRET),
 * so the website keeps running and only /api/v1 reports itself as unavailable.
 */
export function getJwtSecret(): string | null {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production') {
    return secret.length >= MIN_PRODUCTION_SECRET_LENGTH ? secret : null;
  }
  return secret || DEV_JWT_SECRET;
}

export function signAccessToken(userId: number, role: string, secret: string): string {
  return jwt.sign({ role, typ: 'access' }, secret, {
    subject: String(userId),
    issuer: JWT_ISSUER,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, secret, { issuer: JWT_ISSUER });
    if (typeof payload === 'string' || payload.typ !== 'access') return null;
    const userId = parseInt(String(payload.sub || ''), 10);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return { userId, role: String(payload.role || '') };
  } catch {
    return null;
  }
}

export class ApiTokenService {
  public async issueTokens(userId: number, role: string, secret: string, deviceName?: string | null): Promise<IssuedTokens> {
    const refreshToken = await this.createRefreshToken(userId, deviceName);
    return {
      accessToken: signAccessToken(userId, role, secret),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken
    };
  }

  private async createRefreshToken(userId: number, deviceName?: string | null, conn?: { query: typeof db.query }): Promise<string> {
    const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const runner = conn || db;
    await runner.query(
      `INSERT INTO api_refresh_tokens (user_id, token_hash, device_name, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [userId, hashRefreshToken(rawToken), deviceName ? String(deviceName).slice(0, 120) : null, REFRESH_TOKEN_TTL_DAYS]
    );
    return rawToken;
  }

  /**
   * Exchanges a refresh token for a new one. Presenting an already-revoked token
   * revokes every token of that user, since it means the token was copied.
   */
  public async rotateRefreshToken(rawToken: string): Promise<{ userId: number; refreshToken: string } | null> {
    const trimmed = (rawToken || '').trim();
    if (!trimmed) return null;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT id, user_id as userId, device_name as deviceName, revoked_at as revokedAt,
                expires_at > NOW() as isLive
         FROM api_refresh_tokens
         WHERE token_hash = ?
         LIMIT 1
         FOR UPDATE`,
        [hashRefreshToken(trimmed)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        await conn.rollback();
        return null;
      }

      const userId = Number(row.userId);
      if (row.revokedAt) {
        await conn.query(
          `UPDATE api_refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
          [userId]
        );
        await conn.commit();
        return null;
      }
      if (!Number(row.isLive)) {
        await conn.rollback();
        return null;
      }

      await conn.query(`UPDATE api_refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [row.id]);
      const refreshToken = await this.createRefreshToken(userId, row.deviceName, conn as any);
      await conn.commit();
      return { userId, refreshToken };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  public async revokeRefreshToken(rawToken: string): Promise<void> {
    const trimmed = (rawToken || '').trim();
    if (!trimmed) return;
    await db.query(
      `UPDATE api_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL`,
      [hashRefreshToken(trimmed)]
    );
  }

  public async revokeAllForUser(userId: number): Promise<void> {
    await db.query(
      `UPDATE api_refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
  }
}

export const apiTokenService = new ApiTokenService();
