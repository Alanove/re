"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const crypto = __importStar(require("crypto"));
const database_1 = require("../../src/config/database");
class UsersService {
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
    hashPassword(password, salt) {
        return crypto.createHash('sha256').update(password + salt).digest('hex');
    }
    verifyPassword(password, hash, salt) {
        const hashedPassword = this.hashPassword(password, salt);
        return hashedPassword === hash;
    }
    async authenticateUser(email, password) {
        const user = await this.getUserByEmail(email);
        if (!user) {
            return null;
        }
        if (user.status !== 'Active') {
            return null;
        }
        if (!user.email || !user.password || !user.salt) {
            return null;
        }
        if (!this.verifyPassword(password, user.password, user.salt)) {
            return null;
        }
        return user;
    }
    async getAllUsers() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          COALESCE(language, 'en') as language,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        ORDER BY id DESC
      `);
            return rows;
        }
        catch (error) {
            console.error('Error fetching users:', error);
            return [];
        }
    }
    async getActiveUsers() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          COALESCE(language, 'en') as language,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE status = ?
        ORDER BY id DESC
      `, ['Active']);
            return rows;
        }
        catch (error) {
            console.error('Error fetching active users:', error);
            return [];
        }
    }
    async getUserById(id) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          COALESCE(language, 'en') as language,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE id = ?
      `, [id]);
            const users = rows;
            return users[0] || null;
        }
        catch (error) {
            console.error('Error fetching user by ID:', error);
            return null;
        }
    }
    async getUserByEmail(email) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, username as name, email, phone, password, salt, status, role,
          COALESCE(language, 'en') as language,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt, '' as notes
        FROM users
        WHERE email = ?
      `, [email]);
            const users = rows;
            return users[0] || null;
        }
        catch (error) {
            console.error('Error fetching user by email:', error);
            return null;
        }
    }
    async createUser(userData) {
        if (userData.email && await this.getUserByEmail(userData.email)) {
            throw new Error('User with this email already exists');
        }
        let salt;
        let hashedPassword;
        if (userData.password) {
            salt = this.generateSalt();
            hashedPassword = this.hashPassword(userData.password, salt);
        }
        try {
            const [result] = await database_1.db.query(`
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
            ]);
            const insertId = result.insertId;
            const newUser = await this.getUserById(insertId);
            if (!newUser)
                throw new Error('Failed to retrieve created user');
            return newUser;
        }
        catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }
    async updateUser(id, updates) {
        const user = await this.getUserById(id);
        if (!user) {
            return null;
        }
        if (updates.email && updates.email !== user.email) {
            const existingUser = await this.getUserByEmail(updates.email);
            if (existingUser && existingUser.id !== id) {
                throw new Error('User with this email already exists');
            }
        }
        try {
            const updateFields = [];
            const values = [];
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
            if (updates.language !== undefined) {
                updateFields.push('language = ?');
                values.push(updates.language);
            }
            if (updateFields.length === 0) {
                return user;
            }
            values.push(id);
            await database_1.db.query(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
            return await this.getUserById(id);
        }
        catch (error) {
            console.error('Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }
    async updateUserPassword(id, newPassword) {
        const user = await this.getUserById(id);
        if (!user) {
            return false;
        }
        const newSalt = this.generateSalt();
        const hashedPassword = this.hashPassword(newPassword, newSalt);
        try {
            await database_1.db.query(`
        UPDATE users
        SET password = ?, salt = ?
        WHERE id = ?
      `, [hashedPassword, newSalt, id]);
            return true;
        }
        catch (error) {
            console.error('Error updating user password:', error);
            return false;
        }
    }
    async updateUserStatus(id, status) {
        try {
            await database_1.db.query(`
        UPDATE users
        SET status = ?
        WHERE id = ?
      `, [status, id]);
            return true;
        }
        catch (error) {
            console.error('Error updating user status:', error);
            return false;
        }
    }
    async deleteUser(id) {
        try {
            const [result] = await database_1.db.query(`
        DELETE FROM users WHERE id = ?
      `, [id]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    }
    async getUsersCount() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT COUNT(*) as count FROM users
      `);
            return rows[0].count;
        }
        catch (error) {
            console.error('Error getting users count:', error);
            return 0;
        }
    }
    async getActiveUsersCount() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT COUNT(*) as count FROM users WHERE status = ?
      `, ['Active']);
            return rows[0].count;
        }
        catch (error) {
            console.error('Error getting active users count:', error);
            return 0;
        }
    }
    async userExists(id) {
        const user = await this.getUserById(id);
        return user !== null;
    }
    async emailExists(email) {
        const user = await this.getUserByEmail(email);
        return user !== null;
    }
    validateUserData(userData, requireEmailPassword = true) {
        const errors = [];
        if (!userData.name || userData.name.trim().length < 2) {
            errors.push('Name must be at least 2 characters long');
        }
        if (requireEmailPassword && (!userData.email || !this.isValidEmail(userData.email))) {
            errors.push('Please provide a valid email address');
        }
        else if (userData.email && !this.isValidEmail(userData.email)) {
            errors.push('Please provide a valid email address');
        }
        if (requireEmailPassword && (!userData.password || userData.password.length < 6)) {
            errors.push('Password must be at least 6 characters long');
        }
        else if (userData.password && userData.password.length < 6) {
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
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    async getUserStatistics() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive
        FROM users
      `);
            const stats = rows[0];
            return {
                total: stats.total,
                active: stats.active,
                inactive: stats.inactive
            };
        }
        catch (error) {
            console.error('Error getting user statistics:', error);
            return { total: 0, active: 0, inactive: 0 };
        }
    }
    async getUsersWithApartmentCount() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          u.id,
          u.username as name,
          u.email,
          u.phone,
          u.password,
          u.salt,
          u.status,
          u.role,
          DATE_FORMAT(u.created_at, '%Y-%m-%dT%TZ') as createdAt,
          '' as notes,
          COUNT(a.id) as apartmentCount
        FROM users u
        LEFT JOIN apartments a ON u.id = a.owner_id
        GROUP BY u.id, u.username, u.email, u.phone, u.password, u.salt, u.status, u.role, u.created_at
        ORDER BY u.id DESC
      `);
            return rows.map((row) => ({
                ...row,
                apartmentCount: parseInt(row.apartmentCount) || 0
            }));
        }
        catch (error) {
            console.error('Error fetching users with apartment count:', error);
            return [];
        }
    }
    async getUserLanguage(userId) {
        const user = await this.getUserById(userId);
        return user?.language || 'en';
    }
    async updateUserLanguage(userId, language) {
        try {
            await database_1.db.query(`
        UPDATE users
        SET language = ?
        WHERE id = ?
      `, [language, userId]);
            return true;
        }
        catch (error) {
            console.error('Error updating user language:', error);
            return false;
        }
    }
    async getUserWithApartments(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user)
                return null;
            const [apartments] = await database_1.db.query(`
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
                apartments: apartments
            };
        }
        catch (error) {
            console.error('Error fetching user with apartments:', error);
            return null;
        }
    }
}
exports.UsersService = UsersService;
exports.usersService = new UsersService();
//# sourceMappingURL=usersService.js.map