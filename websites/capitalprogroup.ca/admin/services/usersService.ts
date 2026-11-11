import * as fs from 'fs';
import * as crypto from 'crypto';
import { DATA_PATHS } from '../../src/constants';

// User interface
export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  salt: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  notes?: string;
}

// Users data interface
interface UsersData {
  users: User[];
}

export class UsersService {
  private dataPath: string;
  private usersData: UsersData;

  constructor() {
    this.dataPath = DATA_PATHS.USERS_FILE;
    this.usersData = this.loadUsers();
  }

  /**
   * Load users from JSON file
   */
  private loadUsers(): UsersData {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading users:', error);
      return { users: [] };
    }
  }

  /**
   * Save users to JSON file
   */
  private saveUsers(): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.usersData, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving users:', error);
      throw new Error('Failed to save users data');
    }
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
  public authenticateUser(email: string, password: string): User | null {
    const user = this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }

    if (user.status !== 'Active') {
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
  public getAllUsers(): User[] {
    return this.usersData.users;
  }

  /**
   * Get active users only
   */
  public getActiveUsers(): User[] {
    return this.usersData.users.filter(user => user.status === 'Active');
  }

  /**
   * Get user by ID
   */
  public getUserById(id: number): User | null {
    return this.usersData.users.find(user => user.id === id) || null;
  }

  /**
   * Get user by email
   */
  public getUserByEmail(email: string): User | null {
    return this.usersData.users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Create new user
   */
  public createUser(userData: Omit<User, 'id' | 'password' | 'salt' | 'createdAt'> & { password: string }): User {
    // Check if email already exists
    if (this.getUserByEmail(userData.email)) {
      throw new Error('User with this email already exists');
    }

    const salt = this.generateSalt();
    const hashedPassword = this.hashPassword(userData.password, salt);
    const id = Math.max(...this.usersData.users.map(u => u.id), 0) + 1;

    const newUser: User = {
      id,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      salt,
      status: userData.status,
      createdAt: new Date().toISOString(),
      ...(userData.notes && { notes: userData.notes })
    };

    this.usersData.users.push(newUser);
    this.saveUsers();

    return newUser;
  }

  /**
   * Update user
   */
  public updateUser(id: number, updates: Partial<Omit<User, 'id' | 'password' | 'salt' | 'createdAt'>>): User | null {
    const userIndex = this.usersData.users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return null;
    }

    const user = this.usersData.users[userIndex];
    if (!user) {
      return null;
    }

    // Check if email is being changed and if it already exists
    if (updates.email && updates.email !== user.email) {
      const existingUser = this.getUserByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('User with this email already exists');
      }
    }

    // Update user fields
    Object.assign(user, updates);
    
    this.saveUsers();
    return user;
  }

  /**
   * Update user password
   */
  public updateUserPassword(id: number, newPassword: string): boolean {
    const user = this.getUserById(id);
    
    if (!user) {
      return false;
    }

    const newSalt = this.generateSalt();
    const hashedPassword = this.hashPassword(newPassword, newSalt);
    
    user.password = hashedPassword;
    user.salt = newSalt;
    
    this.saveUsers();
    return true;
  }

  /**
   * Update user status
   */
  public updateUserStatus(id: number, status: 'Active' | 'Inactive'): boolean {
    const user = this.getUserById(id);
    
    if (!user) {
      return false;
    }

    user.status = status;
    this.saveUsers();
    return true;
  }

  /**
   * Delete user
   */
  public deleteUser(id: number): boolean {
    const userIndex = this.usersData.users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return false;
    }

    this.usersData.users.splice(userIndex, 1);
    this.saveUsers();
    return true;
  }

  /**
   * Get users count
   */
  public getUsersCount(): number {
    return this.usersData.users.length;
  }

  /**
   * Get active users count
   */
  public getActiveUsersCount(): number {
    return this.usersData.users.filter(user => user.status === 'Active').length;
  }

  /**
   * Check if user exists
   */
  public userExists(id: number): boolean {
    return this.usersData.users.some(user => user.id === id);
  }

  /**
   * Check if email exists
   */
  public emailExists(email: string): boolean {
    return this.usersData.users.some(user => user.email.toLowerCase() === email.toLowerCase());
  }

  /**
   * Validate user data
   */
  public validateUserData(userData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      errors.push('Please provide a valid email address');
    }

    if (!userData.password || userData.password.length < 6) {
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
  public getUserStatistics(): {
    total: number;
    active: number;
    inactive: number;
  } {
    const total = this.usersData.users.length;
    const active = this.usersData.users.filter(user => user.status === 'Active').length;
    const inactive = total - active;

    return {
      total,
      active,
      inactive
    };
  }
}

// Export singleton instance
export const usersService = new UsersService(); 


// Email: admin@gebco.com
// Password: admin123

// Email: manager@gebco.com
// Password: manager123

// Email: editor@gebco.com
// Password: editor123
