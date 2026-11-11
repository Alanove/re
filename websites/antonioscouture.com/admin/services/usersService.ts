import * as crypto from 'crypto';
import { db } from '../../src/config/database';

// User interface
export interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  salt?: string;
  status: 'Active' | 'Inactive';
  role: 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';
  createdAt: string;
  notes?: string;
  language?: string;
}

type UsersTableCaps = { phone: boolean; language: boolean };

export class UsersService {
  private usersTableColumnsPromise: Promise<UsersTableCaps> | null = null;

  /**
   * Older DBs (see src/database/schema.sql) have no phone/language on users.
   * Migrated installs add columns; introspect once and shape queries accordingly.
   */
  private async getUsersTableColumns(): Promise<UsersTableCaps> {
    if (!this.usersTableColumnsPromise) {
      this.usersTableColumnsPromise = (async (): Promise<UsersTableCaps> => {
        try {
          const [rows] = await db.query(
            `SELECT COLUMN_NAME AS col FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            ['users']
          );
          const normalized = new Set(
            (rows as { col: string }[]).map((r) => String(r.col || '').toLowerCase()).filter(Boolean)
          );
          return {
            phone: normalized.has('phone'),
            language: normalized.has('language'),
          };
        } catch (e) {
          console.warn('[UsersService] users column introspection failed; assuming minimal schema', e);
          return { phone: false, language: false };
        }
      })();
    }
    return this.usersTableColumnsPromise;
  }

  private async selectUserProjection(tableAlias = ''): Promise<string> {
    const cols = await this.getUsersTableColumns();
    const p = tableAlias ? `${tableAlias}.` : '';
    const phoneExpr = cols.phone ? `${p}phone` : 'CAST(NULL AS CHAR) AS phone';
    const languageExpr = cols.language
      ? `COALESCE(${p}language, 'en') AS language`
      : `'en' AS language`;
    return `
      ${p}id,
      ${p}username AS name,
      ${p}email,
      ${phoneExpr},
      ${p}password,
      ${p}salt,
      ${p}status,
      ${p}role,
      ${languageExpr},
      DATE_FORMAT(${p}created_at, '%Y-%m-%dT%TZ') AS createdAt,
      '' AS notes`;
  }

  /**
   * Generate a random salt
   */
  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hash password with salt using SHA-256
   */
  private hashPassword(password: string, salt: string): string {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  /**
   * Verify password against stored hash
   */
  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const hashedPassword = this.hashPassword(password, salt);
    return hashedPassword === hash;
  }

  /**
   * Authenticate user by email and password
   */
  public async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }

    if (user.status !== 'Active') {
      return null;
    }

    // Users without email/password cannot log in
    if (!user.email || !user.password || !user.salt) {
      return null;
    }

    if (!this.verifyPassword(password, user.password, user.salt)) {
      return null;
    }

    return user;
  }

  /**
   * Get all users
   */
  public async getAllUsers(): Promise<User[]> {
    try {
      const sel = await this.selectUserProjection();
      const [rows] = await db.query(`
        SELECT ${sel}
        FROM users
        ORDER BY id DESC
      `);
      return rows as User[];
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
      const sel = await this.selectUserProjection();
      const [rows] = await db.query(`
        SELECT ${sel}
        FROM users
        WHERE status = ?
        ORDER BY id DESC
      `, ['Active']);
      return rows as User[];
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
      const sel = await this.selectUserProjection();
      const [rows] = await db.query(`
        SELECT ${sel}
        FROM users
        WHERE id = ?
      `, [id]);
      const users = rows as User[];
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
      const sel = await this.selectUserProjection();
      const [rows] = await db.query(`
        SELECT ${sel}
        FROM users
        WHERE email = ?
      `, [email]);
      const users = rows as User[];
      return users[0] || null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  public async createUser(userData: Omit<User, 'id' | 'password' | 'salt' | 'createdAt'> & { password?: string }): Promise<User> {
    // Check if email already exists (only if email is provided)
    if (userData.email && await this.getUserByEmail(userData.email)) {
      throw new Error('User with this email already exists');
    }

    let salt: string | undefined;
    let hashedPassword: string | undefined;
    
    // Only hash password if provided
    if (userData.password) {
      salt = this.generateSalt();
      hashedPassword = this.hashPassword(userData.password, salt);
    }

    try {
      const caps = await this.getUsersTableColumns();
      const [result] = caps.phone
        ? await db.query(`
        INSERT INTO users (username, email, phone, password, salt, status, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.name,
        userData.email || null,
        userData.phone || null,
        hashedPassword || null,
        salt || null,
        userData.status,
        userData.role || 'Member'
      ])
        : await db.query(`
        INSERT INTO users (username, email, password, salt, status, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        userData.name,
        userData.email || null,
        hashedPassword || null,
        salt || null,
        userData.status,
        userData.role || 'Member'
      ]);
      
      const insertId = (result as any).insertId;
      const newUser = await this.getUserById(insertId);
      if (!newUser) throw new Error('Failed to retrieve created user');
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
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

    // Check if email is being changed and if it already exists
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.getUserByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('User with this email already exists');
      }
    }

    try {
      const caps = await this.getUsersTableColumns();
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
      if (updates.phone !== undefined && caps.phone) {
        updateFields.push('phone = ?');
        values.push(updates.phone);
      } else if (updates.phone !== undefined && !caps.phone) {
        console.warn('[UsersService] users.phone column missing; skipping phone update');
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.role !== undefined) {
        updateFields.push('role = ?');
        values.push(updates.role);
      }
      if ((updates as any).language !== undefined) {
        if (caps.language) {
          updateFields.push('language = ?');
          values.push((updates as any).language);
        }
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
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
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

    const newSalt = this.generateSalt();
    const hashedPassword = this.hashPassword(newPassword, newSalt);
    
    try {
      await db.query(`
        UPDATE users
        SET password = ?, salt = ?
        WHERE id = ?
      `, [hashedPassword, newSalt, id]);
      
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
   * Create or fix the local development admin row so credentials used by Dev Login succeed.
   * Only invoked from startup when NODE_ENV is not production.
   */
  public async ensureDevBootstrapUser(opts: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<void> {
    const email = opts.email.trim();
    if (!email || !opts.password) {
      console.warn('[dev-admin-bootstrap] Skipped: empty email or password');
      return;
    }

    try {
      let user = await this.getUserByEmail(email);

      if (!user) {
        await this.createUser({
          name: opts.displayName,
          email,
          status: 'Active',
          role: 'Super Admin',
          password: opts.password,
        });
        console.log(`[dev-admin-bootstrap] Created Super Admin for ${email}`);
        return;
      }

      const valid = await this.authenticateUser(email, opts.password);
      if (!valid) {
        await this.updateUserPassword(user.id, opts.password);
        console.log(`[dev-admin-bootstrap] Reset password for ${email}`);
      }

      user = await this.getUserById(user.id);
      if (!user) return;

      if (user.status !== 'Active') {
        await this.updateUserStatus(user.id, 'Active');
        console.log(`[dev-admin-bootstrap] Activated user ${email}`);
      }

      if (user.role !== 'Super Admin' && user.role !== 'Admin') {
        await this.updateUser(user.id, { role: 'Super Admin' });
        console.log(`[dev-admin-bootstrap] Set role Super Admin for ${email}`);
      }
    } catch (err) {
      console.error('[dev-admin-bootstrap] Failed:', err);
      throw err;
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
    if (requireEmailPassword && (!userData.password || userData.password.length < 6)) {
      errors.push('Password must be at least 6 characters long');
    } else if (userData.password && userData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
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
      const sel = await this.selectUserProjection('u');
      const [rows] = await db.query(`
        SELECT 
          ${sel},
          0 as apartmentCount
        FROM users u
        ORDER BY u.id DESC
      `);
      
      return (rows as any[]).map((row: any) => ({
        ...row,
        apartmentCount: parseInt(row.apartmentCount) || 0
      }));
    } catch (error) {
      console.error('Error fetching users with apartment count:', error);
      return [];
    }
  }

  /**
   * Get user language preference
   */
  public async getUserLanguage(userId: number): Promise<string> {
    const user = await this.getUserById(userId);
    return user?.language || 'en';
  }

  /**
   * Update user language preference
   */
  public async updateUserLanguage(userId: number, language: string): Promise<boolean> {
    try {
      const caps = await this.getUsersTableColumns();
      if (!caps.language) {
        return true;
      }
      await db.query(`
        UPDATE users
        SET language = ?
        WHERE id = ?
      `, [language, userId]);
      return true;
    } catch (error) {
      console.error('Error updating user language:', error);
      return false;
    }
  }

  /**
   * Get user with their apartments
   */
  public async getUserWithApartments(userId: number): Promise<(User & { apartments: any[] }) | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return null;

      return {
        ...user,
        apartments: [] as any[],
      };
    } catch (error) {
      console.error('Error fetching user with apartments:', error);
      return null;
    }
  }
}

// Export singleton instance
export const usersService = new UsersService();
