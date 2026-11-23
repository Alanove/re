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
const database_1 = require("../src/config/database");
async function up() {
    console.log('Adding create_shipment_response to order_shipments...');
    try {
        await database_1.db.query(`
      ALTER TABLE order_shipments
      ADD COLUMN create_shipment_response TEXT NULL DEFAULT NULL
      COMMENT 'Full CreateShipment API response (JSON or XML) - provider-agnostic'
      AFTER waybill_label_url
    `);
    }
    catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('  Column create_shipment_response already exists');
        }
        else
            throw err;
    }
    console.log('  ✓ order_shipments updated');
}
async function down() {
    await database_1.db.query('ALTER TABLE order_shipments DROP COLUMN IF EXISTS create_shipment_response');
    console.log('  ✓ create_shipment_response dropped');
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
//# sourceMappingURL=2026-02-14-order-shipments-aramex-response.js.map