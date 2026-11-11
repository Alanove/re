import { db } from '../config/database';
import { usersService } from '../../admin/services/usersService';
import { User } from '../../admin/services/usersService';

export interface OAuthProfile {
  provider: 'google' | 'microsoft' | 'facebook';
  providerId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface OAuthUser extends User {
  oauth_provider?: string;
  oauth_id?: string;
}

export class OAuthService {
  private static instance: OAuthService;

  private constructor() {}

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Find or create user from OAuth profile
   */
  public async findOrCreateUser(
    profile: OAuthProfile,
    role: string = 'customer'
  ): Promise<OAuthUser | null> {
    try {
      // First, try to find existing user by OAuth ID
      const [oauthRows] = await db.query<any>(
        'SELECT user_id, provider, provider_id FROM user_oauth WHERE provider = ? AND provider_id = ?',
        [profile.provider, profile.providerId]
      );

      if (oauthRows.length > 0) {
        // User exists, get user data
        const user = await usersService.getUserById(oauthRows[0].user_id);
        if (user) {
          return {
            ...user,
            oauth_provider: profile.provider,
            oauth_id: profile.providerId
          };
        }
      }

      // Try to find by email
      const existingUser = await usersService.getUserByEmail(profile.email);
      if (existingUser) {
        // Link OAuth account to existing user
        await this.linkOAuthAccount(existingUser.id, profile);
        return {
          ...existingUser,
          oauth_provider: profile.provider,
          oauth_id: profile.providerId
        };
      }

      // Create new user
      const newUser = await this.createUserFromOAuth(profile, role);
      if (newUser) {
        // Link OAuth account
        await this.linkOAuthAccount(newUser.id, profile);
        return {
          ...newUser,
          oauth_provider: profile.provider,
          oauth_id: profile.providerId
        };
      }

      return null;
    } catch (error) {
      console.error('Error finding or creating OAuth user:', error);
      throw error;
    }
  }

  /**
   * Create user from OAuth profile
   */
  private async createUserFromOAuth(
    profile: OAuthProfile,
    role: string
  ): Promise<User | null> {
    try {
      // Generate username from email
      const username = profile.email.split('@')[0] + '_' + Date.now().toString().slice(-6);

      // Create user (usersService should handle this)
      // For now, we'll insert directly since we need OAuth-specific handling
      const [result] = await db.query<any>(
        `INSERT INTO users (username, email, status, role, created_at)
        VALUES (?, ?, 'Active', ?, NOW())`,
        [username, profile.email, role]
      );

      const userId = (result as any).insertId;
      return await usersService.getUserById(userId);
    } catch (error) {
      console.error('Error creating user from OAuth:', error);
      return null;
    }
  }

  /**
   * Link OAuth account to user
   */
  private async linkOAuthAccount(userId: number, profile: OAuthProfile): Promise<void> {
    try {
      // Check if link already exists
      const [existing] = await db.query<any>(
        'SELECT id FROM user_oauth WHERE user_id = ? AND provider = ? AND provider_id = ?',
        [userId, profile.provider, profile.providerId]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO user_oauth (user_id, provider, provider_id, email, name, picture, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            name = VALUES(name),
            picture = VALUES(picture),
            updated_at = NOW()`,
          [userId, profile.provider, profile.providerId, profile.email, profile.name, profile.picture || null]
        );
      }
    } catch (error) {
      console.error('Error linking OAuth account:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Unlink OAuth account from user
   */
  public async unlinkOAuthAccount(userId: number, provider: string): Promise<void> {
    try {
      await db.query(
        'DELETE FROM user_oauth WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );
    } catch (error) {
      console.error('Error unlinking OAuth account:', error);
      throw error;
    }
  }

  /**
   * Get user's OAuth accounts
   */
  public async getUserOAuthAccounts(userId: number): Promise<Array<{
    provider: string;
    provider_id: string;
    email: string;
    name: string;
    created_at: Date;
  }>> {
    try {
      const [rows] = await db.query<any>(
        'SELECT provider, provider_id, email, name, created_at FROM user_oauth WHERE user_id = ?',
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user OAuth accounts:', error);
      return [];
    }
  }

  /**
   * Check if user has OAuth account
   */
  public async hasOAuthAccount(userId: number, provider: string): Promise<boolean> {
    try {
      const [rows] = await db.query<any>(
        'SELECT id FROM user_oauth WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking OAuth account:', error);
      return false;
    }
  }
}

export default OAuthService.getInstance();

