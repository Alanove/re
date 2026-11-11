import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { db } from '../../src/config/database';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// User interface
export interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  salt?: string;
  googleId?: string | null;
  status: 'Active' | 'Inactive';
  role: 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';
  walletEnabled?: boolean;
  createdAt: string;
  lastLogin?: string | null;
  notes?: string;
}

export class UsersService {
  /**
   * Legacy SHA-256 hash (pre-bcrypt accounts)
   */
  private hashPasswordLegacy(password: string, salt: string): string {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  private isBcryptHash(hash: string): boolean {
    return /^\$2[aby]?\$/.test(hash);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private verifyLegacyPassword(password: string, hash: string, salt: string): boolean {
    const hashedPassword = this.hashPasswordLegacy(password, salt);
    try {
      const a = Buffer.from(hashedPassword, 'utf8');
      const b = Buffer.from(hash, 'utf8');
      if (a.length !== b.length) {
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async verifyPassword(password: string, hash: string, salt?: string): Promise<boolean> {
    if (this.isBcryptHash(hash)) {
      return bcrypt.compare(password, hash);
    }
    if (!salt) {
      return false;
    }
    return this.verifyLegacyPassword(password, hash, salt);
  }

  /**
   * Normalize phone for comparison (digits only)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Map a DB user row to the User interface
   */
  private mapUserRow(row: any): User {
    return {
      ...row,
      walletEnabled: Boolean(Number(row.walletEnabled ?? row.wallet_enabled ?? 0))
    };
  }

  /**
   * Authenticate by email or phone + password
   */
  public async authenticateUser(login: string, password: string): Promise<User | null> {
    const trimmed = (login || '').trim();
    if (!trimmed || !password) {
      return null;
    }

    let user: User | null = null;
    if (trimmed.includes('@')) {
      user = await this.getUserByEmail(trimmed);
    } else {
      user = await this.getUserByPhone(trimmed);
    }

    // Fallback: try the other identifier if first lookup failed
    if (!user) {
      user = trimmed.includes('@')
        ? await this.getUserByPhone(trimmed)
        : await this.getUserByEmail(trimmed);
    }

    if (!user) {
      return null;
    }

    if (user.status !== 'Active') {
      return null;
    }

    if (!user.password) {
      return null;
    }

    const valid = await this.verifyPassword(password, user.password, user.salt);
    if (!valid) {
      return null;
    }

    // Transparent upgrade from legacy SHA-256 to bcrypt
    if (!this.isBcryptHash(user.password)) {
      await this.updateUserPassword(user.id, password);
    }

    return user;
  }

  /**
   * Get user by phone (digits-only match)
   */
  public async getUserByPhone(phone: string): Promise<User | null> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return null;
    }

    try {
      const [rows] = await db.query(`
        SELECT
          id, username as name, email, phone, password, salt, google_id as googleId,
          status, role, wallet_enabled as walletEnabled,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '+', ''), '.', '') = ?
        LIMIT 1
      `, [normalized]);
      const users = (rows as any[]).map((row) => this.mapUserRow(row));
      return users[0] || null;
    } catch (error) {
      console.error('Error fetching user by phone:', error);
      return null;
    }
  }

  /**
   * Get all users
   */
  public async getAllUsers(): Promise<User[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          wallet_enabled as walletEnabled,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(last_login, '%Y-%m-%dT%TZ') as lastLogin,
          '' as notes
        FROM users
        ORDER BY id DESC
      `);
      return (rows as any[]).map((row) => this.mapUserRow(row));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  /**
   * Get active users only
   */
  public async getActiveUsers(): Promise<User[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          wallet_enabled as walletEnabled,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE status = ?
        ORDER BY id DESC
      `, ['Active']);
      return (rows as any[]).map((row) => this.mapUserRow(row));
    } catch (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: number): Promise<User | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, google_id as googleId,
          status, role, wallet_enabled as walletEnabled,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE id = ?
      `, [id]);
      const users = (rows as any[]).map((row) => this.mapUserRow(row));
      return users[0] || null;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, google_id as googleId,
          status, role, wallet_enabled as walletEnabled,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE LOWER(email) = LOWER(?)
      `, [email]);
      const users = (rows as any[]).map((row) => this.mapUserRow(row));
      return users[0] || null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  /**
   * Record a successful sign-in. Failures are logged and do not throw,
   * so a timestamp write cannot block login.
   */
  public async recordLastLogin(userId: number): Promise<void> {
    try {
      await db.query(`
        UPDATE users SET last_login = NOW() WHERE id = ?
      `, [userId]);
    } catch (error) {
      console.error('Error recording last login:', error);
    }
  }

  /**
   * Store Google OAuth subject id on user
   */
  public async setGoogleId(userId: number, googleId: string): Promise<boolean> {
    try {
      await db.query(`
        UPDATE users SET google_id = ? WHERE id = ?
      `, [googleId, userId]);
      return true;
    } catch (error) {
      console.error('Error setting google_id:', error);
      return false;
    }
  }

  /**
   * Generate a random temporary password (plain text — caller hashes via updateUserPassword)
   */
  public generateTempPassword(length: number = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Ensure email is not already used by another user
   */
  public async assertEmailAvailable(email: string, excludeUserId?: number): Promise<void> {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      return;
    }
    const existing = await this.getUserByEmail(trimmed);
    if (existing && existing.id !== excludeUserId) {
      throw new Error('A user with this email already exists');
    }
  }

  /**
   * Ensure phone is not already used by another user (digits-only match)
   */
  public async assertPhoneAvailable(phone: string, excludeUserId?: number): Promise<void> {
    const trimmed = (phone || '').trim();
    if (!trimmed) {
      return;
    }
    const existing = await this.getUserByPhone(trimmed);
    if (existing && existing.id !== excludeUserId) {
      throw new Error('A user with this phone number already exists');
    }
  }

  private rethrowDuplicateConstraint(error: unknown, fallbackMessage: string): never {
    const err = error as { message?: string; code?: string; sqlMessage?: string };
    if (err?.message && /already exists/i.test(err.message)) {
      throw error instanceof Error ? error : new Error(err.message);
    }
    if (err?.code === 'ER_DUP_ENTRY') {
      const detail = String(err.sqlMessage || err.message || '');
      if (/email/i.test(detail)) {
        throw new Error('A user with this email already exists');
      }
      if (/phone/i.test(detail)) {
        throw new Error('A user with this phone number already exists');
      }
    }
    console.error(fallbackMessage + ':', error);
    throw new Error(fallbackMessage);
  }

  /**
   * Create new user
   */
  public async createUser(userData: Omit<User, 'id' | 'password' | 'salt' | 'createdAt'> & { password?: string }): Promise<User> {
    await this.assertEmailAvailable(userData.email || '');
    await this.assertPhoneAvailable(userData.phone || '');

    let hashedPassword: string | undefined;

    // Only hash password if provided (bcrypt; salt column left null)
    if (userData.password) {
      hashedPassword = await this.hashPassword(userData.password);
    }

    try {
      const [result] = await db.query(`
        INSERT INTO users (username, email, phone, password, salt, status, role, wallet_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.name,
        userData.email || null,
        userData.phone || null,
        hashedPassword || null,
        null,
        userData.status,
        userData.role || 'Member',
        userData.walletEnabled ? 1 : 0
      ]);
      
      const insertId = (result as any).insertId;
      const newUser = await this.getUserById(insertId);
      if (!newUser) throw new Error('Failed to retrieve created user');
      return newUser;
    } catch (error) {
      this.rethrowDuplicateConstraint(error, 'Failed to create user');
    }
  }

  /**
   * Update user
   */
  public async updateUser(id: number, updates: Partial<Omit<User, 'id' | 'password' | 'salt' | 'createdAt'>>): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    if (updates.email !== undefined && updates.email !== user.email) {
      await this.assertEmailAvailable(updates.email || '', id);
    }

    if (updates.phone !== undefined) {
      const currentNorm = this.normalizePhone(user.phone || '');
      const nextNorm = this.normalizePhone(updates.phone || '');
      if (nextNorm && nextNorm !== currentNorm) {
        await this.assertPhoneAvailable(updates.phone, id);
      }
    }

    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.name !== undefined) {
        updateFields.push('username = ?');
        values.push(updates.name);
      }
      if (updates.email !== undefined) {
        updateFields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.phone !== undefined) {
        updateFields.push('phone = ?');
        values.push(updates.phone);
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.role !== undefined) {
        updateFields.push('role = ?');
        values.push(updates.role);
      }
      if (updates.walletEnabled !== undefined) {
        updateFields.push('wallet_enabled = ?');
        values.push(updates.walletEnabled ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return user;
      }

      values.push(id);
      await db.query(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getUserById(id);
    } catch (error) {
      this.rethrowDuplicateConstraint(error, 'Failed to update user');
    }
  }

  /**
   * Update user password
   */
  public async updateUserPassword(id: number, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user) {
      return false;
    }

    const hashedPassword = await this.hashPassword(newPassword);

    try {
      await db.query(`
        UPDATE users
        SET password = ?, salt = NULL
        WHERE id = ?
      `, [hashedPassword, id]);

      return true;
    } catch (error) {
      console.error('Error updating user password:', error);
      return false;
    }
  }

  /**
   * Update user status
   */
  public async updateUserStatus(id: number, status: 'Active' | 'Inactive'): Promise<boolean> {
    try {
      await db.query(`
        UPDATE users
        SET status = ?
        WHERE id = ?
      `, [status, id]);
      
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      return false;
    }
  }

  /**
   * Delete user
   */
  public async deleteUser(id: number): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM users WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get users count
   */
  public async getUsersCount(): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count FROM users
      `);
      return (rows as any)[0].count;
    } catch (error) {
      console.error('Error getting users count:', error);
      return 0;
    }
  }

  /**
   * Get active users count
   */
  public async getActiveUsersCount(): Promise<number> {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count FROM users WHERE status = ?
      `, ['Active']);
      return (rows as any)[0].count;
    } catch (error) {
      console.error('Error getting active users count:', error);
      return 0;
    }
  }

  /**
   * Check if user exists
   */
  public async userExists(id: number): Promise<boolean> {
    const user = await this.getUserById(id);
    return user !== null;
  }

  /**
   * Check if email exists
   */
  public async emailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user !== null;
  }

  /**
   * Validate user data
   */
  public validateUserData(userData: any, requireEmailPassword: boolean = true): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    // Only validate email if required or if provided
    if (requireEmailPassword && (!userData.email || !this.isValidEmail(userData.email))) {
      errors.push('Please provide a valid email address');
    } else if (userData.email && !this.isValidEmail(userData.email)) {
      errors.push('Please provide a valid email address');
    }

    // Only validate password if required or if provided
    if (requireEmailPassword && (!userData.password || userData.password.length < MIN_PASSWORD_LENGTH)) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    } else if (userData.password && userData.password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    if (userData.status && !['Active', 'Inactive'].includes(userData.status)) {
      errors.push('Status must be either Active or Inactive');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get user statistics
   */
  public async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    try {
      const [rows] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive
        FROM users
      `);
      
      const stats = (rows as any)[0];
      return {
        total: stats.total,
        active: stats.active,
        inactive: stats.inactive
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return { total: 0, active: 0, inactive: 0 };
    }
  }

  /**
   * Get users with their apartment count
   */
  public async getUsersWithApartmentCount(): Promise<(User & { apartmentCount: number })[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          u.id,
          u.username as name,
          u.email,
          u.phone,
          u.password,
          u.salt,
          u.status,
          u.role,
          u.wallet_enabled as walletEnabled,
          DATE_FORMAT(u.created_at, '%Y-%m-%dT%TZ') as createdAt,
          '' as notes,
          COUNT(a.id) as apartmentCount
        FROM users u
        LEFT JOIN apartments a ON u.id = a.owner_id
        GROUP BY u.id, u.username, u.email, u.phone, u.password, u.salt, u.status, u.role, u.wallet_enabled, u.created_at
        ORDER BY u.id DESC
      `);
      
      return (rows as any[]).map((row: any) => ({
        ...this.mapUserRow(row),
        apartmentCount: parseInt(row.apartmentCount) || 0
      }));
    } catch (error) {
      console.error('Error fetching users with apartment count:', error);
      return [];
    }
  }

  /**
   * Get user with their apartments
   */
  public async getUserWithApartments(userId: number): Promise<(User & { apartments: any[] }) | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return null;

      const [apartments] = await db.query(`
        SELECT 
          a.id,
          a.apartment_number,
          a.apartment_number_unofficial,
          a.floor,
          a.size,
          a.status,
          DATE_FORMAT(a.registration_date, '%Y-%m-%dT%TZ') as registrationDate,
          a.notes,
          DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt
        FROM apartments a
        WHERE a.owner_id = ?
        ORDER BY a.id DESC
      `, [userId]);

      return {
        ...user,
        apartments: apartments as any[]
      };
    } catch (error) {
      console.error('Error fetching user with apartments:', error);
      return null;
    }
  }

  /**
   * Enable member-portal wallet for all users linked to an apartment
   * (apartment_users, plus owner_id / renter_id fallbacks).
   */
  public async enableWalletForApartmentMembers(apartmentId: number): Promise<void> {
    try {
      await db.query(
        `
        UPDATE users u
        SET u.wallet_enabled = 1
        WHERE u.wallet_enabled = 0
          AND (
            u.id IN (SELECT user_id FROM apartment_users WHERE apartment_id = ?)
            OR u.id IN (SELECT owner_id FROM apartments WHERE id = ? AND owner_id IS NOT NULL)
            OR u.id IN (SELECT renter_id FROM apartments WHERE id = ? AND renter_id IS NOT NULL)
          )
      `,
        [apartmentId, apartmentId, apartmentId]
      );
    } catch (error) {
      console.error('Error enabling wallet for apartment members:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const usersService = new UsersService();
