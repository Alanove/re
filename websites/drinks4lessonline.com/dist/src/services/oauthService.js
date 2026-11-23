"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthService = void 0;
const database_1 = require("../config/database");
const usersService_1 = require("../../admin/services/usersService");
class OAuthService {
    constructor() { }
    static getInstance() {
        if (!OAuthService.instance) {
            OAuthService.instance = new OAuthService();
        }
        return OAuthService.instance;
    }
    async findOrCreateUser(profile, role = 'customer') {
        try {
            const [oauthRows] = await database_1.db.query('SELECT user_id, provider, provider_id FROM user_oauth WHERE provider = ? AND provider_id = ?', [profile.provider, profile.providerId]);
            if (oauthRows.length > 0) {
                const user = await usersService_1.usersService.getUserById(oauthRows[0].user_id);
                if (user) {
                    return {
                        ...user,
                        oauth_provider: profile.provider,
                        oauth_id: profile.providerId
                    };
                }
            }
            const existingUser = await usersService_1.usersService.getUserByEmail(profile.email);
            if (existingUser) {
                await this.linkOAuthAccount(existingUser.id, profile);
                return {
                    ...existingUser,
                    oauth_provider: profile.provider,
                    oauth_id: profile.providerId
                };
            }
            const newUser = await this.createUserFromOAuth(profile, role);
            if (newUser) {
                await this.linkOAuthAccount(newUser.id, profile);
                return {
                    ...newUser,
                    oauth_provider: profile.provider,
                    oauth_id: profile.providerId
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error finding or creating OAuth user:', error);
            throw error;
        }
    }
    async createUserFromOAuth(profile, role) {
        try {
            const username = profile.email.split('@')[0] + '_' + Date.now().toString().slice(-6);
            const [result] = await database_1.db.query(`INSERT INTO users (username, email, status, role, created_at)
        VALUES (?, ?, 'Active', ?, NOW())`, [username, profile.email, role]);
            const userId = result.insertId;
            return await usersService_1.usersService.getUserById(userId);
        }
        catch (error) {
            console.error('Error creating user from OAuth:', error);
            return null;
        }
    }
    async linkOAuthAccount(userId, profile) {
        try {
            const [existing] = await database_1.db.query('SELECT id FROM user_oauth WHERE user_id = ? AND provider = ? AND provider_id = ?', [userId, profile.provider, profile.providerId]);
            if (existing.length === 0) {
                await database_1.db.query(`INSERT INTO user_oauth (user_id, provider, provider_id, email, name, picture, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            name = VALUES(name),
            picture = VALUES(picture),
            updated_at = NOW()`, [userId, profile.provider, profile.providerId, profile.email, profile.name, profile.picture || null]);
            }
        }
        catch (error) {
            console.error('Error linking OAuth account:', error);
        }
    }
    async unlinkOAuthAccount(userId, provider) {
        try {
            await database_1.db.query('DELETE FROM user_oauth WHERE user_id = ? AND provider = ?', [userId, provider]);
        }
        catch (error) {
            console.error('Error unlinking OAuth account:', error);
            throw error;
        }
    }
    async getUserOAuthAccounts(userId) {
        try {
            const [rows] = await database_1.db.query('SELECT provider, provider_id, email, name, created_at FROM user_oauth WHERE user_id = ?', [userId]);
            return rows;
        }
        catch (error) {
            console.error('Error getting user OAuth accounts:', error);
            return [];
        }
    }
    async hasOAuthAccount(userId, provider) {
        try {
            const [rows] = await database_1.db.query('SELECT id FROM user_oauth WHERE user_id = ? AND provider = ?', [userId, provider]);
            return rows.length > 0;
        }
        catch (error) {
            console.error('Error checking OAuth account:', error);
            return false;
        }
    }
}
exports.OAuthService = OAuthService;
exports.default = OAuthService.getInstance();
//# sourceMappingURL=oauthService.js.map