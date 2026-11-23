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
async function initializePaymentMethods() {
    try {
        console.log('🚀 Initializing default payment methods...\n');
        const [existing] = await database_1.db.query('SELECT id FROM payment_methods LIMIT 1');
        if (existing.length > 0) {
            console.log('✅ Payment methods already initialized\n');
            return;
        }
        await database_1.db.query(`INSERT INTO payment_methods (name, code, type, description, is_active, order_index)
      VALUES (?, ?, ?, ?, ?, ?)`, [
            'Cash on Delivery',
            'cash_on_delivery',
            'manual',
            'Pay with cash when your order is delivered',
            true,
            1
        ]);
        console.log('  ✓ Created: Cash on Delivery');
        await database_1.db.query(`INSERT INTO payment_methods (name, code, type, description, config, is_active, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            'Pay with bank card',
            'netcommerce',
            'gateway',
            'Pay with bank card',
            JSON.stringify({ sandbox: true }),
            true,
            2
        ]);
        console.log('  ✓ Created: Pay with bank card');
        console.log('\n✅ Payment methods initialized successfully!\n');
    }
    catch (error) {
        console.error('❌ Error initializing payment methods:', error);
        throw error;
    }
    finally {
        await database_1.db.close();
    }
}
if (require.main === module) {
    initializePaymentMethods()
        .then(() => {
        process.exit(0);
    })
        .catch((err) => {
        console.error('Error:', err);
        process.exit(1);
    });
}
exports.default = initializePaymentMethods;
//# sourceMappingURL=2025-01-15-init-payment-methods.js.map