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
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv_1.default.config({ path: envPath });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const database_1 = require("../src/config/database");
async function up() {
    console.log('Adding tracking_number and waybill_label_url to orders table...');
    const [columns] = await database_1.db.query(`SHOW COLUMNS FROM orders LIKE 'tracking_number'`);
    if (columns.length === 0) {
        await database_1.db.query(`
      ALTER TABLE orders
        ADD COLUMN tracking_number VARCHAR(100) NULL DEFAULT NULL AFTER shipping_method,
        ADD COLUMN waybill_label_url TEXT NULL DEFAULT NULL AFTER tracking_number
    `);
        console.log('  ✓ Added tracking_number and waybill_label_url columns');
    }
    else {
        console.log('  ✓ Columns already exist, skipping');
    }
}
async function down() {
    await database_1.db.query(`
    ALTER TABLE orders 
      DROP COLUMN IF EXISTS tracking_number,
      DROP COLUMN IF EXISTS waybill_label_url
  `);
    console.log('  ✓ Removed tracking_number and waybill_label_url columns');
}
async function run() {
    try {
        await up();
        process.exit(0);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
//# sourceMappingURL=2026-02-04-add-tracking-to-orders.js.map