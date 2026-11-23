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
exports.db = void 0;
const mysql = __importStar(require("mysql2/promise"));
const database_config_1 = require("./database.config");
class Database {
    constructor() {
        this.pool = null;
    }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    getPool() {
        if (!this.pool) {
            this.pool = mysql.createPool(database_config_1.dbConfig);
            console.log('✅ MySQL connection pool created');
        }
        return this.pool;
    }
    async getConnection() {
        try {
            const pool = this.getPool();
            const connection = await pool.getConnection();
            return connection;
        }
        catch (err) {
            console.error('Failed to get connection from pool:', err);
            throw err;
        }
    }
    async query(sql, params) {
        const pool = this.getPool();
        return pool.query(sql, params);
    }
    async execute(sql, params) {
        const pool = this.getPool();
        return pool.execute(sql, params);
    }
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('Database connection pool closed');
        }
    }
    async testConnection() {
        try {
            const connection = await this.getConnection();
            await connection.ping();
            connection.release();
            console.log('✅ Connected to MySQL database');
            return true;
        }
        catch (err) {
            console.error('❌ Failed to connect to database:', err);
            return false;
        }
    }
}
exports.db = Database.getInstance();
exports.default = exports.db;
//# sourceMappingURL=database.js.map