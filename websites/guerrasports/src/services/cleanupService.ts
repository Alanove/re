
import cartService from './cartService';
import { CustomerController } from '../controllers/customerController';
import db from '../config/database';

export class CleanupService {
  private static instance: CleanupService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GUEST_CART_DAYS = 14; // Clean session (guest) carts not updated in 2 weeks
  private readonly CUSTOMER_CART_DAYS = 365; // Clean customer carts not updated in 1 year
  private readonly DATA_RETENTION_DAYS = 30; // Keep guest wishlist data for 30 days

  private constructor() {}

  public static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService();
    }
    return CleanupService.instance;
  }

  public start(): void {
    if (this.intervalId) {
      return;
    }

    console.log('🧹 Cleanup service started');

    // Delay first run by 2 minutes so the server is fully ready
    // and startup traffic doesn't contend with bulk deletes
    setTimeout(() => this.runCleanup(), 2 * 60 * 1000);

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🧹 Cleanup service stopped');
    }
  }

  private async runCleanup(): Promise<void> {
    try {
      console.log('🧹 Starting daily cleanup...');

      // Cleanup old session (guest) carts — 2 weeks
      const deletedSessionCarts = await cartService.deleteOldSessionCarts(this.GUEST_CART_DAYS);
      if (deletedSessionCarts > 0) {
        console.log(`✓ Cleaned up ${deletedSessionCarts} old session (guest) carts`);
      }

      // Cleanup old customer carts — 1 year
      const deletedCustomerCarts = await cartService.deleteOldCustomerCarts(this.CUSTOMER_CART_DAYS);
      if (deletedCustomerCarts > 0) {
        console.log(`✓ Cleaned up ${deletedCustomerCarts} old customer carts`);
      }

      // Cleanup old session wishlists
      const deletedWishlists = await CustomerController.deleteOldSessionWishlists(this.DATA_RETENTION_DAYS);
      if (deletedWishlists > 0) {
         console.log(`✓ Cleaned up ${deletedWishlists} old guest wishlist items`);
      }

      // Prune order_status_history for orders older than 2 years
      try {
        const [histResult] = await db.query<any>(
          `DELETE osh FROM order_status_history osh
           JOIN orders o ON osh.order_id = o.id
           WHERE o.created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)`
        );
        const histDeleted = (histResult as any).affectedRows ?? 0;
        if (histDeleted > 0) {
          console.log(`✓ Cleaned up ${histDeleted} old order status history rows`);
        }
      } catch (error) {
        console.error('❌ Error cleaning order_status_history:', error);
      }

      // Prune stale pending transactions older than 7 days (abandoned checkouts)
      try {
        const [txResult] = await db.query<any>(
          `DELETE FROM transactions
           WHERE status = 'pending'
             AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );
        const txDeleted = (txResult as any).affectedRows ?? 0;
        if (txDeleted > 0) {
          console.log(`✓ Cleaned up ${txDeleted} stale pending transactions`);
        }
      } catch (error) {
        console.error('❌ Error cleaning transactions:', error);
      }

      // Prune order_shipments (packages) for orders older than 2 years
      try {
        const [shipResult] = await db.query<any>(
          `DELETE os FROM order_shipments os
           INNER JOIN orders o ON o.id = os.order_id
           WHERE o.created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)`
        );
        const shipDeleted = (shipResult as any).affectedRows ?? 0;
        if (shipDeleted > 0) {
          console.log(`✓ Cleaned up ${shipDeleted} old order shipment (packages) rows`);
        }
      } catch (error) {
        console.error('❌ Error cleaning order_shipments:', error);
      }

      // Prune expired sessions (express-mysql-session: expires is Unix timestamp in seconds)
      try {
        const [sessResult] = await db.query<any>(
          'DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()'
        );
        const sessDeleted = (sessResult as any).affectedRows ?? 0;
        if (sessDeleted > 0) {
          console.log(`✓ Cleaned up ${sessDeleted} expired session rows`);
        }
      } catch (error) {
        console.error('❌ Error cleaning sessions:', error);
      }

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

export default CleanupService.getInstance();
