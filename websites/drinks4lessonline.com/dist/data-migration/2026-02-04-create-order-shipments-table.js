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
    console.log('Creating order_shipments table...');
    await database_1.db.query(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      
      -- Shipment tracking (from CreateShipments API)
      tracking_number VARCHAR(100) NULL DEFAULT NULL COMMENT 'Aramex AWB/shipment number',
      waybill_label_url TEXT NULL DEFAULT NULL COMMENT 'Shipping label URL',
      shipment_created_at DATETIME NULL DEFAULT NULL,
      
      -- Pickup scheduling (from CreatePickup API)
      pickup_reference VARCHAR(100) NULL DEFAULT NULL COMMENT 'Aramex pickup ID',
      pickup_guid VARCHAR(100) NULL DEFAULT NULL,
      pickup_date DATE NULL DEFAULT NULL COMMENT 'Scheduled pickup date',
      pickup_ready_time TIME NULL DEFAULT NULL COMMENT 'Ready from time',
      pickup_closing_time TIME NULL DEFAULT NULL COMMENT 'Last pickup time',
      pickup_location VARCHAR(255) NULL DEFAULT NULL COMMENT 'e.g. Reception',
      pickup_vehicle VARCHAR(50) NULL DEFAULT NULL COMMENT 'Bike, Car, Truck',
      pickup_scheduled_at DATETIME NULL DEFAULT NULL,
      
      -- Shipment details
      product_group VARCHAR(10) NULL DEFAULT NULL COMMENT 'DOM or EXP',
      product_type VARCHAR(10) NULL DEFAULT NULL COMMENT 'PPX, ONP, etc',
      payment_type VARCHAR(10) NULL DEFAULT NULL COMMENT 'P=Prepaid, C=Collect',
      number_of_pieces INT NULL DEFAULT NULL,
      total_weight DECIMAL(10,2) NULL DEFAULT NULL,
      weight_unit VARCHAR(10) NULL DEFAULT 'kg',
      
      -- Additional info
      description_of_goods VARCHAR(255) NULL DEFAULT NULL,
      comments TEXT NULL DEFAULT NULL,
      status VARCHAR(50) NULL DEFAULT 'pending' COMMENT 'pending, pickup_scheduled, shipment_created, in_transit, delivered',
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      INDEX idx_order_id (order_id),
      INDEX idx_tracking_number (tracking_number),
      INDEX idx_pickup_reference (pickup_reference),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('  ✓ order_shipments table created');
}
async function down() {
    await database_1.db.query('DROP TABLE IF EXISTS order_shipments');
    console.log('  ✓ order_shipments table dropped');
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
//# sourceMappingURL=2026-02-04-create-order-shipments-table.js.map