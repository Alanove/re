"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const cartService_1 = __importDefault(require("./cartService"));
const customerController_1 = require("../controllers/customerController");
const database_1 = __importDefault(require("../config/database"));
class CleanupService {
    constructor() {
        this.intervalId = null;
        this.CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
        this.GUEST_CART_DAYS = 14;
        this.CUSTOMER_CART_DAYS = 365;
        this.DATA_RETENTION_DAYS = 30;
    }
    static getInstance() {
        if (!CleanupService.instance) {
            CleanupService.instance = new CleanupService();
        }
        return CleanupService.instance;
    }
    start() {
        if (this.intervalId) {
            return;
        }
        console.log('🧹 Cleanup service started');
        setTimeout(() => this.runCleanup(), 2 * 60 * 1000);
        this.intervalId = setInterval(() => {
            this.runCleanup();
        }, this.CLEANUP_INTERVAL_MS);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🧹 Cleanup service stopped');
        }
    }
    async runCleanup() {
        try {
            console.log('🧹 Starting daily cleanup...');
            const deletedSessionCarts = await cartService_1.default.deleteOldSessionCarts(this.GUEST_CART_DAYS);
            if (deletedSessionCarts > 0) {
                console.log(`✓ Cleaned up ${deletedSessionCarts} old session (guest) carts`);
            }
            const deletedCustomerCarts = await cartService_1.default.deleteOldCustomerCarts(this.CUSTOMER_CART_DAYS);
            if (deletedCustomerCarts > 0) {
                console.log(`✓ Cleaned up ${deletedCustomerCarts} old customer carts`);
            }
            const deletedWishlists = await customerController_1.CustomerController.deleteOldSessionWishlists(this.DATA_RETENTION_DAYS);
            if (deletedWishlists > 0) {
                console.log(`✓ Cleaned up ${deletedWishlists} old guest wishlist items`);
            }
            try {
                const [histResult] = await database_1.default.query(`DELETE osh FROM order_status_history osh
           JOIN orders o ON osh.order_id = o.id
           WHERE o.created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)`);
                const histDeleted = histResult.affectedRows ?? 0;
                if (histDeleted > 0) {
                    console.log(`✓ Cleaned up ${histDeleted} old order status history rows`);
                }
            }
            catch (error) {
                console.error('❌ Error cleaning order_status_history:', error);
            }
            try {
                const [txResult] = await database_1.default.query(`DELETE FROM transactions
           WHERE status = 'pending'
             AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`);
                const txDeleted = txResult.affectedRows ?? 0;
                if (txDeleted > 0) {
                    console.log(`✓ Cleaned up ${txDeleted} stale pending transactions`);
                }
            }
            catch (error) {
                console.error('❌ Error cleaning transactions:', error);
            }
            try {
                const [shipResult] = await database_1.default.query(`DELETE os FROM order_shipments os
           INNER JOIN orders o ON o.id = os.order_id
           WHERE o.created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)`);
                const shipDeleted = shipResult.affectedRows ?? 0;
                if (shipDeleted > 0) {
                    console.log(`✓ Cleaned up ${shipDeleted} old order shipment (packages) rows`);
                }
            }
            catch (error) {
                console.error('❌ Error cleaning order_shipments:', error);
            }
            try {
                const [sessResult] = await database_1.default.query('DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()');
                const sessDeleted = sessResult.affectedRows ?? 0;
                if (sessDeleted > 0) {
                    console.log(`✓ Cleaned up ${sessDeleted} expired session rows`);
                }
            }
            catch (error) {
                console.error('❌ Error cleaning sessions:', error);
            }
        }
        catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }
}
exports.CleanupService = CleanupService;
exports.default = CleanupService.getInstance();
//# sourceMappingURL=cleanupService.js.map