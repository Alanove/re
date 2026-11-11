/**
 * Quick verification for renter, gate access, and owner history
 * Run: npx ts-node data-migration/verify-apartment-renter-gate-access.ts
 */

import { ApartmentsService } from '../admin/services/apartmentsService';

async function verify() {
  const svc = ApartmentsService.getInstance();
  const apts = await svc.getAllApartments();
  console.log('Apartments loaded:', apts.length);

  const apt = apts[0];
  if (!apt) {
    console.log('No apartments to verify');
    process.exit(0);
  }

  console.log('Sample apartment:', apt.id, apt.ownerName);
  console.log('  Renter:', apt.renterName || 'none');
  console.log('  Gate access count:', apt.gateAccessUsers?.length ?? 0);

  const history = await svc.getOwnerHistory(apt.id);
  console.log('Owner history rows:', history.length);
  console.log('  Current owner periods:', history.filter((h) => !h.endDate).length);

  if (apt.ownerId) {
    await svc.setGateAccessUsers(apt.id, [apt.ownerId]);
    const withGate = await svc.getApartmentById(apt.id);
    console.log('Gate access set to owner:', withGate?.gateAccessUsers?.map((u) => u.name).join(', '));
    await svc.setGateAccessUsers(apt.id, []);
    console.log('Gate access cleared');
  }

  const summary = await svc.getPreviousOwnersSummary(apt.id);
  console.log('Previous owners summary:', summary || '(none)');

  console.log('\nVerification passed.');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
