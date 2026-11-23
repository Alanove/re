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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv_1.default.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const promise_1 = __importDefault(require("mysql2/promise"));
const database_config_1 = require("../src/config/database.config");
async function run() {
    const pool = promise_1.default.createPool({
        ...database_config_1.dbConfig,
        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0
    });
    const conn = await pool.getConnection();
    try {
        console.log('\n🔄 Migration: pages.page_image_thumb\n');
        const [cols] = await conn.query(`SHOW COLUMNS FROM pages WHERE Field = ?`, ['page_image_thumb']);
        if (cols.length > 0) {
            console.log('  ⚠️  pages.page_image_thumb already exists — skip\n');
        }
        else {
            const [imageCol] = await conn.query(`SHOW COLUMNS FROM pages WHERE Field = ?`, ['page_image']);
            if (imageCol.length === 0) {
                await conn.query(`ALTER TABLE pages ADD COLUMN page_image VARCHAR(512) NULL`);
            }
            await conn.query(`ALTER TABLE pages ADD COLUMN page_image_thumb VARCHAR(512) NULL AFTER page_image`);
            console.log('  ✓ Added pages.page_image_thumb\n');
        }
        console.log('✅ Done.\n');
    }
    finally {
        conn.release();
        await pool.end();
    }
}
if (require.main === module) {
    run().then(() => process.exit(0), (e) => {
        console.error(e);
        process.exit(1);
    });
}
exports.default = run;
//# sourceMappingURL=2026-03-23-add-pages-page-image-thumb.js.map