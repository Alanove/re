/**
 * Script to fix duplicate ID 137 issue for year 2026 payments
 * This will delete all 2026 payments and regenerate them with unique IDs
 */

import { ApartmentPaymentsService } from '../services/apartmentPaymentsService';
import { ApartmentsService } from '../services/apartmentsService';

async function fix2026DuplicateIds() {
    console.log('🔧 Starting fix for 2026 duplicate IDs...\n');

    try {
        const apartmentPaymentsService = ApartmentPaymentsService.getInstance();
        const apartmentsService = ApartmentsService.getInstance();

        // Step 1: Get all apartments
        const apartments = apartmentsService.getAllApartments();
        console.log(`✓ Found ${apartments.length} apartments\n`);

        // Step 2: Get current 2026 payments to preserve payment data
        const current2026Payments = apartmentPaymentsService.getApartmentPaymentsForYear(2026);
        console.log(`📋 Found ${current2026Payments.length} existing 2026 payment records`);
        
        // Create a map of apartmentId -> amountPaid for 2026
        const paymentMap = new Map<number, number>();
        current2026Payments.forEach(payment => {
            const existing = paymentMap.get(payment.apartmentId) || 0;
            paymentMap.set(payment.apartmentId, existing + payment.amountPaid);
        });
        
        const apartmentsWithPayments = paymentMap.size;
        const totalPaid = Array.from(paymentMap.values()).reduce((sum, amt) => sum + amt, 0);
        console.log(`💰 ${apartmentsWithPayments} apartments have payments totaling $${totalPaid.toFixed(2)}\n`);

        // Step 3: Delete all 2026 payments
        console.log('🗑️  Deleting all 2026 payment records...');
        const deleted = apartmentPaymentsService.deletePaymentsForYear(2026);
        if (!deleted) {
            console.error('❌ Failed to delete 2026 payments');
            return;
        }
        console.log('✓ Deleted all 2026 payments\n');

        // Step 4: Regenerate 2026 with unique IDs
        console.log('🔄 Regenerating 2026 payments with unique IDs...');
        const result = apartmentPaymentsService.generatePaymentsForYear(2026, apartments);
        
        if (result.success) {
            console.log(`✓ ${result.message}\n`);
        } else {
            console.error(`❌ ${result.message}`);
            return;
        }

        // Step 5: Restore payment amounts for apartments that had payments
        console.log('💳 Restoring payment amounts...');
        let restoredCount = 0;
        for (const [apartmentId, amountPaid] of paymentMap.entries()) {
            if (amountPaid > 0) {
                const newPayments = apartmentPaymentsService.getApartmentPayments(apartmentId);
                const payment2026 = newPayments.find(p => p.year === 2026);
                
                if (payment2026) {
                    const result = apartmentPaymentsService.updatePaymentAmount(payment2026.id, amountPaid);
                    if (result.success) {
                        restoredCount++;
                        console.log(`  ✓ Apartment ${apartmentId}: Restored $${amountPaid.toFixed(2)}`);
                    }
                }
            }
        }
        
        console.log(`\n✅ Successfully restored payments for ${restoredCount} apartments`);
        console.log('\n🎉 Fix completed! All 2026 records now have unique IDs.');
        console.log('👉 You can now create transactions and they will work correctly!\n');

    } catch (error) {
        console.error('❌ Error during fix:', error);
        throw error;
    }
}

// Run the fix
fix2026DuplicateIds()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });

